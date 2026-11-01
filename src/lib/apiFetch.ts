import { logSearch } from './analytics';

export async function apiFetch(url: string, options: any, user: any, page: string) {
  const startTime = Date.now();
  const response = await fetch(url, options);
  
  if (url.startsWith('/api/ai/') && user) {
    try {
      const clone = response.clone();
      const responseData = await clone.json().catch(() => ({}));
      
      let requestBody: any = {};
      if (options && options.body) {
        requestBody = JSON.parse(options.body);
      }
      
      const responseTime = Date.now() - startTime;
      const searchQuery = requestBody.topic || requestBody.query || requestBody.message || requestBody.prompt || requestBody.subject || 'Action';
      const detectedSubject = requestBody.subject || requestBody.unit || 'Unknown';
      const aiResponse = JSON.stringify(responseData);
      
      // Fire and forget
      logSearch(user, page, searchQuery, detectedSubject, aiResponse, responseTime);
    } catch (e) {
      console.error("Failed to parse analytics", e);
    }
  }
  
  return response;
}
