export const logger = {
    info: (message: string, context?: any) => {
        console.log(`[INFO] [${new Date().toISOString()}] ${message}`, context ? JSON.stringify(context) : '');
    },
    error: (message: string, error?: any) => {
        console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error);
    },
    audit: (action: string, user: string, details: any) => {
         console.log(`[AUDIT] [${new Date().toISOString()}] ACTION: ${action} | USER: ${user} | DETAILS:`, JSON.stringify(details));
    }
};
