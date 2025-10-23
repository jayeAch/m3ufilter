import express from "express";
import { Request, Response, NextFunction } from "express";
import { handleGetm3u } from "./handler/getm3u";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

const app = express();
const port = parseInt(process.env.PORT || "3000", 10);
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware
app.use(helmet());

// Compression optimized for m3u files
app.use(compression({
  threshold: 512, // Compress even small responses (m3u files add up)
  filter: (req, res) => {
    const contentType = res.getHeader('Content-Type');
    // Compress all text-based responses including m3u
    return typeof contentType === 'string' && 
           (contentType.includes('text/plain') || 
            contentType.includes('application/x-mpegurl') ||
            contentType.includes('m3u') ||
            contentType.includes('text/html') ||
            contentType.includes('application/json'));
  },
  level: 6, // Good balance of speed vs compression
  memLevel: 8 // Good for text compression
}));

// Rate limiting - important since you're fetching multiple large sources
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Lower limit since processing is expensive
  message: 'Too many requests, please try again later'
});
app.use(limiter);

app.disable('x-powered-by');

// Async handler
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Your m3u endpoint - will be automatically compressed
app.get("/getm3u", asyncHandler(async (req: Request, res: Response) => {
  // Set proper content type for m3u
  res.setHeader('Content-Type', 'application/x-mpegurl');
  // Optional: Add caching headers since your config changes infrequently
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minute cache
  await handleGetm3u({ req, res });
}));

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Error handling
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", {
    message: error.message,
    url: req.url,
    method: req.method
  });
  
  const statusCode = error.status || 500;
  const message = isProduction && statusCode === 500 
    ? 'Internal Server Error' 
    : error.message;
  
  res.status(statusCode).json({ error: message });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`M3U filter server started on port ${port}`);
  console.log(`Compression enabled for m3u responses`);
});
