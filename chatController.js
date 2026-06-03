import Product from '../models/Product.js';
import Chat from '../models/Chat.js';
import GroupCart from '../models/GroupCart.js';
import { GoogleGenAI } from '@google/genai';
import mongoose from 'mongoose';

// ── AI Client Initialization ────────────────────────────────────────────────
let _catalogueCache = null;
let _catalogueCacheUpdated = 0;
let _brandCache = null;
let _brandCacheUpdated = 0;
const CATALOGUE_CACHE_TTL = 10 * 60 * 1000; // Optimize to 10 minutes cache TTL

let geminiClientInstance = null;

const getGeminiClient = () => {
  if (geminiClientInstance) return geminiClientInstance;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey || geminiKey.trim() === '' || geminiKey === 'your_gemini_key_here') {
    return null;
  }
  geminiClientInstance = new GoogleGenAI({ apiKey: geminiKey });
  return geminiClientInstance;
};

// ── AI Client Initialization (Gemini only) ───────────────────────────────────────
export const getAIClient = async () => {
  const client = getGeminiClient();
  if (!client) {
    console.error(`❌ GEMINI_API_KEY not set or placeholder`);
    return { client: null, provider: 'fallback' };
  }
  return { client, provider: 'gemini' };
};

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getProductCatalogue() {
  try {
    const now = Date.now();
    if (_catalogueCache && now - _catalogueCacheUpdated < CATALOGUE_CACHE_TTL) {
      return _catalogueCache;
    }
    const p = await Product.find({ isActive: true }).select('name brand category price colors').limit(20).lean();
    _catalogueCache = p.map(x => `- ${x.name} | ${x.brand} | ${x.category} | Rs.${x.price} | Colors: ${(x.colors || []).join(', ')}`).join('\n');
    _catalogueCacheUpdated = now;
    return _catalogueCache;
  } catch { return 'Catalogue unavailable.'; }
}

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePriceRange(text = '') {
  const normalized = text.toLowerCase().replace(/,/g, '');
  const between = normalized.match(/(?:between|from)\s+(\d+)\s+(?:and|to)\s+(\d+)/);
  if (between) return { $gte: Number(between[1]), $lte: Number(between[2]) };
  const under = normalized.match(/(?:under|below|less than|up to)\s+(\d+)/);
  if (under) return { $lte: Number(under[1]) };
  const over = normalized.match(/(?:over|above|more than|at least)\s+(\d+)/);
  if (over) return { $gte: Number(over[1]) };
  return null;
}

async function getDistinctBrandsCached() {
  const now = Date.now();
  if (_brandCache && now - _brandCacheUpdated < CATALOGUE_CACHE_TTL) return _brandCache;
  try {
    const brands = await Product.distinct('brand');
    _brandCache = (brands || []).filter(Boolean).map(b => b.trim());
    _brandCacheUpdated = now;
    return _brandCache;
  } catch (e) {
    return [];
  }
}

function extractBrandCandidateFromMessage(message = '') {
  const m = message.match(/(?:from|by|of)\s+([A-Za-z0-9&\-\s]{2,30})/i);
  if (m) return m[1].trim();
  return null;
}

async function detectBrandInMessage(message = '') {
  const brands = await getDistinctBrandsCached();
  for (const b of brands) {
    if (!b) continue;
    const pattern = new RegExp(`\\b${escapeRegex(b)}\\b`, 'i');
    if (pattern.test(message)) return b;
  }
  const candidate = extractBrandCandidateFromMessage(message);
  if (candidate) {
    const match = brands.find(b => b && b.toLowerCase() === candidate.toLowerCase());
    if (match) return match;
  }
  return null;
}

function isProductIntent(message = '') {
  if (!message) return false;
  const m = message.toLowerCase();
  return /\b(show|find|search|find me|looking for|recommend|buy|want|looking to buy|any products|any items)\b/.test(m);
}

function isPairingIntent(message = '') {
  if (!message) return false;
  const m = message.toLowerCase();
  return /\b(pair|go with|match|what would go with|recommend (?:with|to go with))\b/.test(m);
}

function isNameQuery(message = '') {
  if (!message) return false;
  return /(what does aaron stand for|what does aaron mean|what is aaron|meaning of aaron|aaron stands for)/i.test(message.trim());
}

async function getBrandsForCategory(category) {
  try {
    const brands = await Product.distinct('brand', { isActive: true, category: new RegExp(escapeRegex(category), 'i') });
    return (brands || []).filter(Boolean);
  } catch (e) { return []; }
}

function buildProductQuery(filters = {}, message = '') {
  const query = { isActive: true };

  if (filters.category) {
    query.category = new RegExp(escapeRegex(filters.category), 'i');
  }
  if (filters.brand) {
    query.brand = new RegExp(escapeRegex(filters.brand), 'i');
  }
  if (filters.name) {
    query.name = new RegExp(escapeRegex(filters.name), 'i');
  }
  // COLOR FILTER INTEGRATION
  if (filters.color) {
    const colorStr = String(filters.color).toLowerCase().trim();
    if (colorStr !== 'all' && colorStr !== 'all colors' && colorStr !== 'null' && colorStr !== 'undefined' && colorStr !== '') {
      if (colorStr.includes(',')) {
        const colorsList = colorStr.split(',').map(c => c.trim()).filter(Boolean);
        query.colors = { $in: colorsList.map(c => new RegExp(escapeRegex(c), 'i')) };
      } else {
        query.colors = new RegExp(escapeRegex(filters.color), 'i');
      }
    }
  }
  if (filters.priceMin != null || filters.priceMax != null) {
    query.price = {};
    if (filters.priceMin != null) query.price.$gte = Number(filters.priceMin);
    if (filters.priceMax != null) query.price.$lte = Number(filters.priceMax);
  }

  if (!filters.name && !filters.brand && !filters.category && !filters.color && Object.keys(query).length === 1 && message) {
    const isBroadCatalogRequest = /\b(show products|show all products|saare products|show collection|our collection|items dikhao|product dikhao|all products|display all|everything)\b/i.test(message.toLowerCase());
    if (!isBroadCatalogRequest) {
      const terms = escapeRegex(message.trim());
      const priceRange = parsePriceRange(message);
      query.$or = [
        { name: new RegExp(terms, 'i') },
        { brand: new RegExp(terms, 'i') },
        { category: new RegExp(terms, 'i') },
        { description: new RegExp(terms, 'i') },
        { tags: new RegExp(terms, 'i') },
        { colors: new RegExp(terms, 'i') }
      ];
      if (priceRange) query.price = priceRange;
    }
  }

  return query;
}

function computeSimilarityScore(base, candidate) {
  let score = 0;
  if (base.brand && candidate.brand && base.brand.toLowerCase() === candidate.brand.toLowerCase()) {
    score += 3;
  }
  if (base.price && candidate.price) {
    const diff = Math.abs(base.price - candidate.price) / base.price;
    if (diff <= 0.2) score += 2;
  }
  const baseTokens = `${base.name || ''} ${base.description || ''}`
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2);
  const candTokens = `${candidate.name || ''} ${candidate.description || ''}`
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2);
  const common = baseTokens.filter(t => candTokens.includes(t)).length;
  score += common;
  return score;
}

export async function callAI(ai, system, history, message) {
  const client = getGeminiClient();
  if (!client) {
    console.error('⚠️ GEMINI_API_KEY not set; skipping AI call');
    return '';
  }
  const mappedHistory = history.map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }]
  }));
  const chatSession = client.chats.create({
    model: 'gemini-3.1-flash-lite',
    history: mappedHistory,
    config: {
      systemInstruction: system,
      responseMimeType: 'application/json'
    }
  });
  const res = await chatSession.sendMessage({ message });
  return res.text;
}

// 🔥 HELPER FUNCTION: Maps color specific image to the index 0 of images array
function applyColorImagesMapping(productsList, selectedColor) {
  if (!selectedColor || !productsList || productsList.length === 0) return productsList;
  
  return productsList.map(product => {
    if (product.colorImages && product.colorImages.length > 0) {
      const matchedColorImage = product.colorImages.find(
        ci => ci.color && ci.color.toLowerCase() === selectedColor.toLowerCase()
      );
      if (matchedColorImage && matchedColorImage.image) {
        // Pushing the specific color image to index 0 so product card renders it automatically
        product.images = [matchedColorImage.image, ...(product.images || [])];
      }
    }
    return product;
  });
}

// Helper to manually parse color keywords from raw user message text
function detectColorInMessage(text = '') {
  const lower = text.toLowerCase();
  const commonColors = ['red', 'black', 'white', 'blue', 'green', 'yellow', 'brown', 'grey', 'gray', 'pink', 'purple', 'maroon'];
  for (const color of commonColors) {
    if (new RegExp(`\\b${color}\\b`, 'i').test(lower)) {
      return color;
    }
  }
  return null;
}

// Check if user is asking to show all colors of a product/category
function checkAllColorsRequest(filters, message) {
  const colorVal = filters.color ? String(filters.color).toLowerCase().trim() : '';
  const messageVal = message ? message.toLowerCase() : '';
  return colorVal === 'all' || colorVal === 'all colors' || /\b(all colors|saare colors|saare available colors|colors|colours)\b/i.test(messageVal);
}

// Generate separate product variant objects (one for each color variant)
function expandProductColorVariants(productsList) {
  if (!productsList || productsList.length === 0) return [];
  const expanded = [];
  for (const product of productsList) {
    if (product.colors && product.colors.length > 0) {
      for (const color of product.colors) {
        const variant = { ...product };
        variant.name = `${product.name} (${color})`;
        variant.colors = [color];
        variant.variantId = `${product._id}_${color}`;
        
        if (product.colorImages && product.colorImages.length > 0) {
          const matched = product.colorImages.find(
            ci => ci.color && ci.color.toLowerCase() === color.toLowerCase()
          );
          if (matched && matched.image) {
            variant.images = [matched.image, ...(product.images || [])];
          }
        }
        expanded.push(variant);
      }
    } else {
      expanded.push(product);
    }
  }
  return expanded;
}

// Verify requested colors availability and politely append out-of-stock colors to response
function verifyColorAvailability(rawList, filters, aiResponse) {
  if (!filters.color) return aiResponse;
  const requestedColors = filters.color.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
  if (requestedColors.length > 1 && rawList.length > 0) {
    const availableColors = new Set();
    rawList.forEach(p => {
      if (p.colors) {
        p.colors.forEach(c => availableColors.add(c.toLowerCase()));
      }
    });
    const missingColors = requestedColors.filter(c => !availableColors.has(c));
    if (missingColors.length > 0 && availableColors.size > 0) {
      const missingStr = missingColors.join(', ');
      return `${aiResponse} (Note: We do not have ${missingStr} variants in stock right now, but here are the available ones.)`;
    }
  }
  return aiResponse;
}

// ── Main Chat Handler ───────────────────────────────────────────────────────
export const chat = async (req, res) => {
  try {
    const { message, sessionId, history = [], productId, color, variantId } = req.body;
    
    // ── Hybrid Intent Routing Interceptor ──────────────────────────────────────
    const lowerMsg = (message || '').toLowerCase().trim();
    
    const localRecalcTotals = (groupCart) => {
      groupCart.totalPrice = groupCart.items.reduce((acc, i) => acc + i.price, 0);
      const acceptedCount = groupCart.members.filter(m => m.status === 'accepted').length;
      groupCart.pricePerMember = acceptedCount > 0
        ? Math.ceil(groupCart.totalPrice / acceptedCount)
        : groupCart.totalPrice;
    };

    // 1. Delete Action Interceptor
    if (lowerMsg.includes('delete')) {
      if (lowerMsg.includes('cart') || lowerMsg.includes('group')) {
        const groupCart = await GroupCart.findOne({ admin: req.user?._id, isActive: true });
        if (groupCart) {
          await GroupCart.findByIdAndDelete(groupCart._id);
          req.io?.to(`group-${groupCart._id}`).emit('group-deleted', { groupCartId: groupCart._id });
          return res.json({
            success: true,
            message: `[Hybrid Route: Delete Cart] Active Group Cart '${groupCart.name}' has been successfully deleted.`,
            products: [],
            brands: [],
            meta: { usedAI: false }
          });
        } else {
          return res.json({
            success: true,
            message: `[Hybrid Route: Delete Cart] No active Group Cart found that you own to delete.`,
            products: [],
            brands: [],
            meta: { usedAI: false }
          });
        }
      } else {
        if (req.user?._id && sessionId) {
          await Chat.findOneAndDelete({ user: req.user._id, sessionId });
          return res.json({
            success: true,
            message: `[Hybrid Route: Delete Session] Chat session deleted successfully.`,
            products: [],
            brands: [],
            meta: { usedAI: false }
          });
        }
      }
    }

    // 2. Checkout Action Interceptor
    if (lowerMsg.includes('checkout')) {
      const groupCart = await GroupCart.findOne({ admin: req.user?._id, isActive: true });
      if (groupCart) {
        groupCart.isConfirmedByAdmin = true;
        localRecalcTotals(groupCart);
        await groupCart.save();
        req.io?.to(`group-${groupCart._id}`).emit('cart-updated', { groupCart });
        return res.json({
          success: true,
          message: `[Hybrid Route: Checkout] Group Cart '${groupCart.name}' has been confirmed and checked out by Admin. Members can now proceed to pay.`,
          products: [],
          brands: [],
          meta: { usedAI: false }
        });
      } else {
        return res.json({
          success: true,
          message: `[Hybrid Route: Checkout] No active Group Cart found under your administration to checkout.`,
          products: [],
          brands: [],
          meta: { usedAI: false }
        });
      }
    }

    // 3. Cart Action Interceptor
    if (lowerMsg.includes('cart')) {
      if (lowerMsg.includes('add')) {
        const productsList = await Product.find({ isActive: true }).select('name price images category');
        let matchedProduct = null;
        for (const p of productsList) {
          if (lowerMsg.includes(p.name.toLowerCase())) {
            matchedProduct = p;
            break;
          }
        }
        
        if (matchedProduct) {
          const groupCart = await GroupCart.findOne({ admin: req.user?._id, isActive: true });
          if (groupCart) {
            groupCart.items.push({
              product: matchedProduct._id,
              name: matchedProduct.name,
              image: matchedProduct.images?.[0] || '',
              price: matchedProduct.price,
              size: 'M'
            });
            localRecalcTotals(groupCart);
            await groupCart.save();
            req.io?.to(`group-${groupCart._id}`).emit('cart-updated', { groupCart });
            
            return res.json({
              success: true,
              message: `[Hybrid Route: Add to Cart] Successfully added '${matchedProduct.name}' (Rs. ${matchedProduct.price}) to your active Group Cart '${groupCart.name}'.`,
              products: [matchedProduct],
              brands: [],
              meta: { usedAI: false }
            });
          } else {
            return res.json({
              success: true,
              message: `[Hybrid Route: Add to Cart] Matched product '${matchedProduct.name}', but you do not have an active Group Cart to add it to. Please create one first.`,
              products: [matchedProduct],
              brands: [],
              meta: { usedAI: false }
            });
          }
        } else {
          return res.json({
            success: true,
            message: `[Hybrid Route: Add to Cart] Could not find any catalog product matching that name to add to your cart.`,
            products: [],
            brands: [],
            meta: { usedAI: false }
          });
        }
      } else {
        const groupCarts = await GroupCart.find({
          $or: [
            { admin: req.user?._id },
            { 'members.email': req.user?.email },
            { 'members.user': req.user?._id },
          ],
          isActive: true,
        }).populate('items.product', 'name images price');

        if (groupCarts.length > 0) {
          const names = groupCarts.map(c => `'${c.name}' (split between ${c.members.length} members)`).join(', ');
          return res.json({
            success: true,
            message: `[Hybrid Route: View Cart] You have ${groupCarts.length} active Group Cart(s): ${names}.`,
            products: [],
            brands: [],
            meta: { usedAI: false }
          });
        } else {
          return res.json({
            success: true,
            message: `[Hybrid Route: View Cart] You do not have any active Group Carts right now.`,
            products: [],
            brands: [],
            meta: { usedAI: false }
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const ai = await getAIClient();
    let aiResponse = '', products = [], usedAI = false, brands = [];

    if (isNameQuery(message)) {
      aiResponse = 'AI Retail Interactive Assistant — AARON stands for <strong>AI Retail Interactive Assistant</strong>. I help users discover products, suggest outfits, and answer fashion-related questions.';
    } else {
      if (ai.client) {
        try {
          const cat = await getProductCatalogue();
          
          let pairRequest = false;
          let baseProduct = null;
          let complementProduct = null;

          if (isPairingIntent(message)) {
            if (productId) {
              try {
                baseProduct = await Product.findById(productId).lean();
              } catch (e) { console.warn('[Chat] Failed to load base product by body productId:', e); }
            }

            if (!baseProduct) {
              const idMatch = message.match(/pair\s+with\s+([a-fA-F0-9]{24})/i);
              if (idMatch) {
                const prodId = idMatch[1];
                try {
                  baseProduct = await Product.findById(prodId).lean();
                } catch (e) { console.warn('[Chat] Failed to load base product by ID:', e); }
              }
            }

            if (!baseProduct) {
              const nameMatch = message.match(/pair\s+with\s+(.+)/i);
              if (nameMatch) {
                const candidateName = nameMatch[1].trim();
                const cleanCandidateName = candidateName.replace(/\s*\([^)]+\)$/, '');
                try {
                  baseProduct = await Product.findOne({
                    isActive: true,
                    name: new RegExp(escapeRegex(cleanCandidateName), 'i')
                  }).lean();
                } catch (e) { console.warn('[Chat] Failed to load base product by name:', e); }
              }
            }

            if (!baseProduct) {
              let prevCategory = null;
              for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].role === 'assistant') {
                  const match = history[i].content.match(/<FILTERS>([\s\S]*?)<\/FILTERS>/);
                  if (match) {
                    try {
                      const prevFilters = JSON.parse(match[1]);
                      if (prevFilters.category) prevCategory = prevFilters.category;
                    } catch (_) {}
                  }
                  break;
                }
              }
              if (prevCategory) {
                try {
                  baseProduct = await Product.findOne({ isActive: true, category: new RegExp(escapeRegex(prevCategory), 'i') }).lean();
                } catch (e) { console.warn('[Chat] Failed to find base product from history category:', e); }
              }
            }

            if (!baseProduct) {
              const cleanMsg = message.replace(/\b(pair|go with|match|what would go with|recommend)\b/gi, '').trim();
              if (cleanMsg) {
                try {
                  baseProduct = await Product.findOne({
                    isActive: true,
                    $or: [
                      { name: new RegExp(escapeRegex(cleanMsg), 'i') },
                      { category: new RegExp(escapeRegex(cleanMsg), 'i') },
                      { brand: new RegExp(escapeRegex(cleanMsg), 'i') }
                    ]
                  }).lean();
                } catch (e) { console.warn('[Chat] Failed to find base product by keyword:', e); }
              }
            }

            if (!baseProduct) {
              try {
                baseProduct = await Product.findOne({ isActive: true }).lean();
              } catch (e) {}
            }

            if (baseProduct) {
              let selectedColor = color || null;
              if (!selectedColor) {
                const nameMatch = message.match(/pair\s+with\s+(.+)/i);
                if (nameMatch) {
                  const candidateName = nameMatch[1].trim();
                  const colorExtract = candidateName.match(/\(([^)]+)\)$/);
                  if (colorExtract) {
                    selectedColor = colorExtract[1];
                  }
                }
              }

              if (selectedColor) {
                baseProduct.color = selectedColor;
                baseProduct.colors = [selectedColor];
              }

              const mapping = {
                'shirts': 'pants',
                'pants': 'shirts',
                'dresses': 'shoes',
                'jackets': 'shirts',
                'shoes': 'pants'
              };
              const compCategory = mapping[baseProduct.category?.toLowerCase()] || 'pants';
              
              try {
                const candidates = await Product.find({
                  isActive: true,
                  _id: { $ne: baseProduct._id },
                  category: new RegExp(escapeRegex(compCategory), 'i')
                }).lean();

                if (candidates.length > 0) {
                  const scored = candidates.map(c => ({ product: c, score: computeSimilarityScore(baseProduct, c) }));
                  scored.sort((a, b) => b.score - a.score);
                  complementProduct = scored[0].product;
                  pairRequest = true;
                }
              } catch (e) { console.warn('[Chat] Failed to find complement product:', e); }
            }
          }

          let system = `You are AARON, a male expert AI fashion stylist and sales assistant for our Smart AI Platform.
Your sole role is to act as a sales and styling assistant for our platform.
If the user asks an out-of-scope question that is not related to fashion styling, outfit recommendations, our products, or order/sales queries (e.g., "Give me a recipe for biryani", coding questions, math, general science, etc.), you must politely decline to answer.

INTENT ANALYSIS, IMMEDIATE RESPONSE & CONVERSATION RULES:
1. Analyze the user's prompt carefully before responding:
   - If the user is asking for a product, looking for recommendations, or shopping, recommend suitable items from the CATALOGUE and populate the "filters" object.
   - If the user is just having a normal conversation (e.g., greeting you, saying thank you, asking general style advice without wanting to buy right now, or just chatting), respond with a friendly, proper conversation. DO NOT force or show products if they are just chatting. Set product-related fields in "filters" to null.
2. IMMEDIATE INTENT EXTRACTION: Do not wait for a perfectly formatted or specific prompt from the user. Whether they type a single keyword ("red shirt"), an unstructured query ("kuch achi si t-shirt dikhao"), or broken English, you MUST intelligently extract the core intent and display relevant results immediately. Prioritize visual display (product cards) over heavy text explanations whenever a product inquiry is detected.

STRICT DYNAMIC LANGUAGE & SCRIPT MIRRORING:
1. Evaluate the language and script of the user's latest prompt on EVERY turn and mirror it exactly:
   - If the prompt is in English -> Respond ONLY in English. Do not use Urdu or Roman Urdu.
   - If the prompt is in Urdu script (e.g., مجھے شرٹ دکھاؤ) -> Respond ONLY in Urdu script. Do not use English or Roman Urdu.
   - If the prompt is in Roman Urdu (e.g., "mujhe shirt dikhao") -> Respond ONLY in Roman Urdu. Do not use English or Urdu script.
2. Maintain this behavior for every single turn. If the user changes their language from one message to the next, you MUST immediately change your response language to match theirs.

CRITICAL INSTRUCTIONS TO FIX EXISTING ERRORS:

1. ABSOLUTE REQUIREMENT FOR PRODUCT DISPLAY (FIX FOR MISSING CARDS):
   - Whenever a user explicitly asks to see products (e.g., "saare products show karwa do", "show me your collection", "mujhe items dikhao"), you are STRICTLY FORBIDDEN from just replying with a text message or a happy greeting. 
   - You MUST immediately trigger the filter parameters with broad metrics or fetch all available active items from the CATALOGUE so the frontend can render the product cards. Text-only responses for catalog requests are considered a system failure.

2. MULTIPLE SPECIFIC COLORS HANDLING (FIX FOR MULTIPLE COLORS ERROR):
   - If a user explicitly requests multiple specific colors at once (e.g., "mujhe red aur blue shirts dikhao", "show me black, white, and green hoodies"), you MUST extract ALL specified colors. Pass them into the "color" filter field (e.g., as a comma-separated list or array structure your parser accepts).
   - FALLBACK LOGIC: 
     a) If ALL requested colors are available in the CATALOGUE, return cards/filters for all of them.
     b) If SOME requested colors are available but others are out of stock, return product cards for the available ones and politely inform the user in the "response" text which ones were missing/out of stock.
     c) If NONE of the requested colors are available, only then show an out-of-stock error message. Never return an empty response or text-only greeting when items exist.

3. ADVANCED PRICE & COLOR FILTERING LIMITS:
   - "Less than X" / "Se kam": Set "priceMax" to X and "priceMin" to null. Recommend all products under that price.
   - "Up to X" / "Tak" / "Equal to X": Set "priceMax" to X and "priceMin" to null. Recommend all products within that limit.
   - "More than X" / "Se ziada": Set "priceMin" to X and "priceMax" to null. Recommend all products above that price.
   - "Show all/overall products" / "Saari products dikhao": Leave both "priceMin" and "priceMax" as null, and list all relevant items available in the category.
   - FORBIDDEN REFUSAL TEMPLATES: You are strictly FORBIDDEN from replying with generic failure messages like "Unavailable: I could not find any products matching your request right now" unless the inventory is completely 100% empty of that item.
4. CRITICAL RULE FOR PAIRING IMAGES & CARDS:
- When the user asks to "Pair" a specific color variation from a bulk list (e.g., "pair the red one"), you MUST NOT return the default product card or default image of that product.
- You must strictly look up the specific color variant requested by the user, extract its exact matching image URL, title, and price, and inject that specific variant's data into the pairing response object.
- The output card for the main item in the pairing MUST explicitly display the image of the requested color (e.g., if pairing a RED shirt, the image URL in the product card payload must point directly to the red shirt image, NOT the default white/black shirt image).
[STRICT CONTEXT & MEMORY RULE]
You have a tendency to forget the user's selected color variant as the conversation grows longer. You MUST aggressively fight this. 

- Whenever a user asks for a "Pairing" or "Outfit Suggestion" based on a previously selected item, you MUST look back at the conversation history, identify the exact color variant the user was interacting with, and lock onto that specific variant.
- NEVER, under any circumstances, fall back to the default product card, default image, or first available array element [0] in later prompts. 
- If the user asks to pair a "red shirt", every subsequent pairing recommendation layout for that shirt MUST explicitly carry the data, image URL, and variant ID of the RED shirt.
You MUST always respond in a strict JSON format with the following schema:
{
  "response": "Your friendly style advice, conversation, product guidance, or polite decline in 2-3 sentences. This text MUST strictly match the language and script used by the user in their latest prompt.",
  "outOfScope": true or false,
  "filters": {
    "category": "category name (one of: shirts, pants, shoes, watches, accessories, jackets, dresses) or null",
    "brand": "exact brand name of the product you are recommending or null",
    "name": "exact name of the product from the CATALOGUE you are recommending or null",
    "color": "color name, or a comma-separated list of multiple requested colors (e.g., 'red,blue'), or null",
    "priceMin": minimum price as a number or null,
    "priceMax": maximum price as a number or null
  }
}

CATALOGUE:
${cat}

CRITICAL: The product items you recommend in your "response" text MUST MATCH EXACTLY with the fields you extract in the "filters" object. If the user is just having a normal conversation, the query is out-of-scope, or no matching products are found for the price, set the respective filter fields to null.`;

          if (pairRequest && baseProduct && complementProduct) {
            const activeColor = baseProduct.color || 'requested color';
            system = `You are AARON, a male expert AI fashion stylist and sales assistant for our Smart AI Platform.
Your sole role is to act as a sales and styling assistant for our platform.
If the user asks an out-of-scope question that is not related to fashion styling, outfit recommendations, our products, or order/sales queries (e.g., "Give me a recipe for biryani", coding questions, math, general science, etc.), you must politely decline to answer.

The user is CURRENTLY looking at and wants to pair the exact '${activeColor}' variant of '${baseProduct.name}' (Brand: ${baseProduct.brand}, Category: ${baseProduct.category}).
We have selected '${complementProduct.name}' (Brand: ${complementProduct.brand}, Category: ${complementProduct.category}) as the perfect complement to this specific '${activeColor}' item.

CRITICAL INSTRUCTIONS TO FIX EXISTING ERRORS:

1. COLOR-PRECISE OUTFIT PAIRING FROM BULK VIEWS (FIX FOR PAIRING ERROR):
   - When multiple color variants are displayed on the screen simultaneously, and the user requests a pairing for a specific variant (e.g., "mujhe is red waali ka pair dikhao", "pair the blue one with jeans"), you MUST lock onto the exact color and product ID of that specific item.
   - When generating the paired outfit card, the primary product in the outfit combination MUST strictly match the exact color variant chosen by the user ('${baseProduct.color || 'requested color'}'). Do not dynamically switch the item to a default color or another category item. The pairing card must seamlessly match the specific user selection.

COHESIVE OUTFIT PAIRING & COLOR RETENTION RULES:
1. VISUAL COHESION: When recommending this complementary item, you MUST pitch and present the combination as a single, cohesive outfit. Explain how well the pieces complement each other.
2. STRICT COLOR RETENTION: For the main base product being paired ('${baseProduct.name}'), you MUST retain the exact same color variant the user originally selected or looked at. Do NOT dynamically change its color variant to a default or different color in the styling text or recommended logic. If they looked at a Red variant, it must remain Red alongside the complement product.
3. ROBUST UNDERSTANDING: Understand the user's prompt perfectly even if they use broken or incorrect English, a single keyword, or unstructured phrases. Immediately extract intent without asking for corrections.

CONVERSATION & DYNAMIC LANGUAGE RULES:
1. Maintain a friendly, proper conversational flow, explaining why this pairing looks great together.
2. Evaluate the language and script of the user's latest prompt on EVERY turn and mirror it exactly:
   - If the prompt is in English -> Respond ONLY in English.
   - If the prompt is in Urdu script -> Respond ONLY in Urdu script.
   - If the prompt is in Roman Urdu -> Respond ONLY in Roman Urdu.
3. If the user changes their language in the next message, you MUST immediately switch your response language to match theirs.
CRITICAL INSTRUCTIONS FOR COLOR LOCK:
1. STRICT COLOR MATCHING: You are FORBIDDEN from describing or referencing any other variant or the default product version. The user is actively interacting with the '${activeColor}' color. Your styling advice and product output parameters MUST strictly reference and output data for the '${activeColor}' variant.
2. TEXT SYNTAX: In your "response" text, explicitly mention that you are pairing the '${activeColor}' variant of '${baseProduct.name}' with '${complementProduct.name}'. (e.g., "This ${activeColor} shirt pairs beautifully with...").
CONVERSATION & DYNAMIC LANGUAGE RULES:
1. Maintain a friendly, proper conversational flow, explaining why this pairing looks great together.
2. Evaluate the language and script of the user's latest prompt on EVERY turn and mirror it exactly (English, Urdu, or Roman Urdu).
You MUST always respond in a strict JSON format with the following schema:
{
  "response": "A friendly, specific style recommendation explaining why this pair works well as a cohesive outfit. You MUST explicitly name both '${baseProduct.name}' (retaining its precise color variant) and '${complementProduct.name}' in this text response (2-3 sentences). This text MUST strictly match the language and script used by the user in their latest prompt.",
  "outOfScope": false,
  "filters": {
    "category": "${complementProduct.category}",
    "brand": "${complementProduct.brand}",
    "name": "${complementProduct.name}",
    "color": null,
    "priceMin": null,
    "priceMax": null
  },"pairingContext": {
    "baseProductId": "${baseProduct._id || baseProduct.id}",
    "baseProductSelectedColor": "${activeColor}"
  }
}

If the query is out-of-scope, set outOfScope to true and all filter fields to null.`;
          }

          const injectedMessage = `You are an AI assistant for our store. Current inventory: ${cat}. User prompt: ${message}. Provide the best matching product.`;
          const raw = await callAI(ai, system, history, injectedMessage);
          usedAI = true;

          let parsed = { response: '', outOfScope: false, filters: {} };
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            console.warn('[Chat] Failed to parse raw AI response as JSON:', raw, e);
            const match = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/```\s*([\s\S]*?)\s*```/);
            const toParse = match ? match[1] : raw;
            try {
              parsed = JSON.parse(toParse);
            } catch (e2) {
              console.error('[Chat] Failed to parse matched JSON block:', toParse, e2);
              parsed = { response: raw, outOfScope: false, filters: {} };
            }
          }

          aiResponse = parsed.response || '';
          let filters = parsed.filters || {};
          Object.keys(filters).forEach(k => {
            if (filters[k] === null || filters[k] === undefined) delete filters[k];
          });

          if (parsed.outOfScope) {
            products = [];
            brands = [];
          } else {
            if (pairRequest && baseProduct && complementProduct) {
              // 🔥 FIXED LOGIC 1: Safe Deep Copy and Color Image Mapping for Outfit Pairing
              const targetColor = filters.color || detectColorInMessage(message) || detectColorInMessage(aiResponse);
              
              // Re-mapping logic running on a cleanly separated list array
              let baseCopy = JSON.parse(JSON.stringify(baseProduct));
              let compCopy = JSON.parse(JSON.stringify(complementProduct));
              
              // Map base product specific image using its selected variant color first
              if (baseProduct.color) {
                baseCopy = applyColorImagesMapping([baseCopy], baseProduct.color)[0];
              } else if (targetColor) {
                baseCopy = applyColorImagesMapping([baseCopy], targetColor)[0];
              }
              
              // Map complement product if targetColor exists
              if (targetColor) {
                compCopy = applyColorImagesMapping([compCopy], targetColor)[0];
              }
              
              products = [baseCopy, compCopy];
            } else {
              const categorySynonyms = {
                'shirt': 'shirts', 't shirt': 'shirts', 't-shirts': 'shirts',
                'pant': 'pants', 'trouser': 'pants', 'shoe': 'shoes',
                'watch': 'watches', 'accessory': 'accessories', 'jacket': 'jackets',
                'dress': 'dresses'
              };
              if (filters.category && typeof filters.category === 'string') {
                const catKey = filters.category.toLowerCase().trim();
                if (categorySynonyms[catKey]) filters.category = categorySynonyms[catKey];
              } else {
                const lowerMsg = message.toLowerCase();
                for (const [syn, std] of Object.entries(categorySynonyms)) {
                  if (lowerMsg.includes(syn)) { filters.category = std; break; }
                }
              }

              const showAllPhrases = [/\bshow all\b/, /\ball outfits\b/, /\ball products\b/, /\bdisplay everything\b/];
              const wantsAll = showAllPhrases.some(re => re.test(message.toLowerCase()));
              const isBroadCatalogRequest = wantsAll || /\b(show products|show all products|saare products|show collection|our collection|items dikhao|product dikhao|all products|display all|everything)\b/i.test(message.toLowerCase());

              const wantsProducts = isProductIntent(message) || Object.keys(filters).length > 0 || wantsAll || isBroadCatalogRequest;

              if (wantsProducts && !aiResponse.includes('Unavailable')) {
                if (!filters.brand) {
                  const brandDetected = await detectBrandInMessage(message);
                  if (brandDetected) filters.brand = brandDetected;
                  else {
                    const candidate = extractBrandCandidateFromMessage(message);
                    if (candidate) {
                      const brandExists = await Product.findOne({ brand: new RegExp(`^${escapeRegex(candidate)}$`, 'i') }).lean();
                      if (!brandExists) {
                        aiResponse = 'Unavailable: We do not carry that brand right now.';
                      } else {
                        filters.brand = brandExists.brand;
                      }
                    }
                  }
                }

                if (filters.category && !filters.brand && !filters.name && !filters.color) {
                  brands = await getBrandsForCategory(filters.category);
                  if (!brands.length) {
                    aiResponse = 'Unavailable: No brands offer that category right now.';
                  } else {
                    const query = buildProductQuery(filters, message);
                    const limit = (wantsAll || isBroadCatalogRequest) ? 20 : 6;
                    let rawList = await Product.find(query).sort({ price: 1 }).limit(limit).lean();
                    
                    aiResponse = verifyColorAvailability(rawList, filters, aiResponse);

                    // 🔥 LOGIC 2a: Color mapping / expansion filter for category items fallback
                    const isAllColors = checkAllColorsRequest(filters, message);
                    if (isAllColors) {
                      products = expandProductColorVariants(rawList);
                    } else {
                      const targetColor = filters.color || detectColorInMessage(message);
                      products = applyColorImagesMapping(rawList, targetColor);
                    }
                  }
                } else if (!aiResponse.includes('Unavailable')) {
                  const query = buildProductQuery(filters, message);
                  const priceRange = parsePriceRange(message);
                  if (priceRange && !query.price) query.price = priceRange;

                  const limit = (wantsAll || isBroadCatalogRequest) ? 20 : 6;
                  let rawList = await Product.find(query).sort({ price: 1 }).limit(limit).lean();
                  
                  aiResponse = verifyColorAvailability(rawList, filters, aiResponse);

                  // 🔥 LOGIC 2b: Color mapping / expansion filter for normal search flow
                  const isAllColors = checkAllColorsRequest(filters, message);
                  if (isAllColors) {
                    products = expandProductColorVariants(rawList);
                  } else {
                    const targetColor = filters.color || detectColorInMessage(message);
                    products = applyColorImagesMapping(rawList, targetColor);
                  }

                  if (!products.length && (Object.keys(filters).length > 0 || priceRange || wantsAll || isBroadCatalogRequest)) {
                    aiResponse = 'Unavailable: I could not find any products matching your request right now.';
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('AI Error:', e.message);
        }
      }
    }

    if (!aiResponse) aiResponse = "I'm AARON! I'm here to help you find the perfect outfit. What are you looking for today?";

    if (req.user?._id && sessionId) {
      Chat.findOneAndUpdate({ user: req.user._id, sessionId }, { $push: { messages: { $each: [{ role: 'user', content: message }, { role: 'assistant', content: aiResponse, products: products.map(p => p._id) }] } } }, { upsert: true }).catch(() => {});
    }

    return res.json({ success: true, message: aiResponse, products, brands, meta: { usedAI, provider: ai.provider } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Chat service unavailable' });
  }
};

export const getChatHistory = async (req, res) => {
  const chats = await Chat.find({ user: req.user._id }).sort('-updatedAt').limit(10).populate('messages.products');
  res.json({ success: true, chats });
};

export const getRecommendations = async (req, res) => {
  const recommendations = await Product.find({ isActive: true, isFeatured: true }).limit(4).lean();
  res.json({ success: true, recommendations, reasoning: "Featured pieces." });
};

export const deleteChatSession = async (req, res) => {
  try {
    const { id } = req.params;
    const query = {
      user: req.user._id,
      $or: []
    };
    
    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }
    query.$or.push({ sessionId: id });

    const result = await Chat.findOneAndDelete(query);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Chat session not found' });
    }
    return res.json({ success: true, message: 'Chat session deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return res.status(500).json({ success: false, message: 'Error deleting chat session' });
  }
};