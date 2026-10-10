import http from 'http';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from './lib/db.js';
import { NexusWebSocketServer } from './realtime/WebSocketServer.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

async function bootstrap() {
  try {
    // 1. Connect to MongoDB
    await connectDb();

    // 2. Initialize application & HTTP server
    const app = createApp();
    const server = http.createServer(app);

    // 3. Attach WebSocket server for real-time streaming
    const wsServer = new NexusWebSocketServer(server);

    // 4. Start listening
    server.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, env: env.NODE_ENV },
        `🚀 NexusFlow API server listening on http://localhost:${env.PORT}`
      );
    });

    // 5. Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received termination signal, starting graceful shutdown...');
      wsServer.close();
      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          await disconnectDb();
          logger.info('All resources released successfully. Exiting process.');
          process.exit(0);
        } catch (err) {
          logger.error({ err }, 'Error during shutdown');
          process.exit(1);
        }
      });

      // Force exit if shutdown hangs beyond 10s
      setTimeout(() => {
        logger.error('Shutdown timed out after 10s, forcing exit');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.fatal({ err }, 'Fatal error during server bootstrap');
    process.exit(1);
  }
}

bootstrap();
