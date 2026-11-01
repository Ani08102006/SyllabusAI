export function logSearch(user: any, page: string, query: string, detectedSubject: string, aiResponse: string, responseTime: number) {
  console.log(`[Analytics] User: ${user?.userId}, Page: ${page}, Query: ${query}, Subject: ${detectedSubject}, Time: ${responseTime}ms`);
}
