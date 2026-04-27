# Groq API Migration Guide

## Overview
Your FinanceAgent AI application has been successfully refactored to use **Groq API** instead of Google Gemini API. This migration provides better performance, cost efficiency, and access to powerful open-source models.

## What Changed

### 1. **API Service Layer** (`js/chatService.js`)
- **New Functions:**
  - `convertConversationToGroqFormat()` - Converts internal message format to OpenAI-compatible format
  - `buildGroqSystemInstruction()` - Creates the system prompt for Groq (replaces `buildGeminiSystemInstruction`)
  - `requestGroqResponse()` - Makes API calls to Groq (replaces `requestGeminiResponse`)
  
- **Backward Compatibility:**
  - `requestGeminiResponse()` still exists but now delegates to `requestGroqResponse()`
  - Ensures smooth transition without breaking existing code

### 2. **API Integration** (`js/app.js`)
- Updated imports to use new functions:
  - `buildGroqSystemInstruction` instead of `buildGeminiSystemInstruction`
  - `requestGroqResponse` instead of `requestGeminiResponse`
- Updated error message mentioning Groq API instead of Gemini

### 3. **UI Updates** (`index.html`)
- Settings page now displays "Groq API Key" instead of "Gemini API Key"
- API key input field remains the same (`id="apiKey"`)

## Key Differences: Groq vs Gemini

### Request Format
```javascript
// Groq (OpenAI-compatible)
{
  model: "mixtral-8x7b-32768",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." },
    { role: "assistant", content: "..." }
  ],
  max_tokens: 1024,
  temperature: 0.7
}

// Gemini (previous)
{
  system_instruction: { parts: [{ text: "..." }] },
  contents: [...]
}
```

### Response Format
```javascript
// Groq (OpenAI-compatible)
{
  choices: [{
    message: {
      content: "..."
    }
  }]
}

// Gemini (previous)
{
  candidates: [{
    content: {
      parts: [{ text: "..." }]
    }
  }]
}
```

### Conversation History
Internal format remains consistent:
```javascript
{
  role: "user" | "model",
  parts: [{ text: "message content" }]
}
```

Groq format conversion happens automatically in `convertConversationToGroqFormat()`.

## Getting Started with Groq

### 1. Get Your API Key
1. Visit [console.groq.com](https://console.groq.com)
2. Sign up or log in to your account
3. Navigate to **Keys** section
4. Create a new API key
5. Copy the key (it starts with `gsk_`)

### 2. Add API Key to FinanceAgent
1. Open the Settings view in the app
2. Scroll to "Groq API Key" section
3. Paste your API key into the input field
4. The key is automatically saved to your browser's local storage

### 3. Start Using AI Features
- Chat with the assistant about your finances
- Get AI-powered analysis and recommendations
- The AI will automatically use your saved key for requests

## API Configuration

### Groq Endpoint
```
https://api.groq.com/openai/v1/chat/completions
```

### Default Model
```
mixtral-8x7b-32768
```

### Request Parameters
- **max_tokens**: 1024 (maximum response length)
- **temperature**: 0.7 (balance between creativity and consistency)

These can be modified in `requestGroqResponse()` if needed.

## Supported Models (as of this migration)

Groq supports several high-performance models:
- `mixtral-8x7b-32768` (default, recommended)
- `llama-2-70b-chat`
- `gemma-7b-it`

To use a different model, modify the `model` parameter in `requestGroqResponse()`:
```javascript
body: JSON.stringify({
  model: "gemma-7b-it",  // Change this
  messages: messages,
  max_tokens: 1024,
  temperature: 0.7
})
```

## Error Handling

### Common Errors

**"Groq API request failed"**
- Check your API key is valid and active
- Verify internet connection
- Check Groq service status

**"Groq returned an empty response"**
- The model didn't generate a response
- Try a simpler or shorter question
- Check rate limits haven't been exceeded

**"Unauthorized" (401)**
- Invalid or expired API key
- Clear the API key and add a new one

## Rate Limits

Groq provides generous rate limits on free tier:
- **Request limit**: Check your Groq account dashboard
- **Token limit**: Depends on your plan
- **Concurrent requests**: Limited to 1 per design

## Cost Considerations

Groq's pricing model:
- Check [groq.com/pricing](https://groq.com/pricing) for current rates
- Free tier available with reasonable limits
- Pay-as-you-go for production use

## Troubleshooting

### API Key Not Working
1. Verify the key is copied correctly (no extra spaces)
2. Check it starts with `gsk_`
3. Ensure key has API access enabled in Groq console
4. Clear browser cache and try again

### Slow Responses
1. Groq is extremely fast - if slow, check internet
2. Verify the model isn't overloaded (rare)
3. Try a simpler query

### No AI Responses
1. Ensure API key is set in Settings
2. Check browser console for error messages
3. Verify you're in the Chat view

## Code Structure

### Message Flow
```
User Input (index.html)
    ↓
sendMessage() (app.js)
    ↓
buildGroqSystemInstruction() → System prompt
    ↓
requestGroqResponse() → Groq API
    ↓
convertConversationToGroqFormat() → Convert messages
    ↓
Groq API Response
    ↓
appendAssistantMessage() → Display in UI
```

### Storage
- API keys stored in browser localStorage (key: `fin_apiKey`)
- Conversation history stored locally
- No data sent to external servers except Groq API

## Migration Checklist

- [x] Groq API functions implemented
- [x] Conversation format conversion added
- [x] UI updated to reference Groq
- [x] Backward compatibility maintained
- [x] Error handling in place
- [x] Documentation created

## Next Steps

1. **Obtain a Groq API key** from https://console.groq.com
2. **Add the key** to Settings in the app
3. **Test the chat** with a simple question
4. **Review performance** - Groq should feel faster than Gemini!

## Technical Details for Developers

### Modifying System Instructions
Edit `buildGroqSystemInstruction()` in `js/chatService.js` to customize the AI's behavior and personality.

### Changing Response Parameters
In `requestGroqResponse()`:
```javascript
body: JSON.stringify({
  model: "mixtral-8x7b-32768",
  messages: messages,
  max_tokens: 2048,      // Increase for longer responses
  temperature: 0.5,      // 0-2: Lower = more consistent, Higher = more creative
  top_p: 0.9,           // Can be added for nucleus sampling
  presence_penalty: 0    // Can be added to reduce repetition
})
```

### Monitoring API Usage
- Check your Groq dashboard at https://console.groq.com
- Monitor tokens used and rate limits
- Set up billing alerts if on paid plan

## Support

- **Groq Documentation**: https://console.groq.com/docs
- **API Reference**: https://console.groq.com/docs/api-reference
- **Community**: https://discord.gg/groq

## Reverting to Gemini (if needed)

The old `requestGeminiResponse()` function still exists for reference:
1. Update imports in `app.js` to use `requestGeminiResponse`
2. Change `buildGeminiSystemInstruction` back in imports
3. Revert HTML to "Gemini API Key"

However, Groq's superior performance makes this unnecessary!

---

**Migration completed successfully!** Your FinanceAgent AI is now powered by Groq's lightning-fast inference engine. 🚀
