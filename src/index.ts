import connectDB, { closeDB } from './config/db';
import { ENV } from './config/env';
import { stopTradeExecutor } from './services/tradeExecutor';
import { stopTradeMonitor } from './services/tradeMonitor';
import Logger from './utils/logger';
import { performHealthCheck, logHealthCheck } from './utils/healthCheck';
import getMyBalance from './utils/getMyBalance';
import fetchData from './utils/fetchData';

const USER_ADDRESSES = ENV.USER_ADDRESSES;
const PROXY_WALLET = ENV.PROXY_WALLET;

// Graceful shutdown handler
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
        Logger.warning('Shutdown already in progress, forcing exit...');
        process.exit(1);
    }

    isShuttingDown = true;
    Logger.separator();
    Logger.info(`Received ${signal}, initiating graceful shutdown...`);

    try {
        // Stop services
        stopTradeMonitor();
        stopTradeExecutor();

        // Give services time to finish current operations
        Logger.info('Waiting for services to finish current operations...');
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Close database connection
        await closeDB();

        Logger.success('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        Logger.error(`Error during shutdown: ${error}`);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    Logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    // Don't exit immediately, let the application try to recover
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    Logger.error(`Uncaught Exception: ${error.message}`);
    // Exit immediately for uncaught exceptions as the application is in an undefined state
    gracefulShutdown('uncaughtException').catch(() => {
        process.exit(1);
    });
});

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export const main = async () => {
    try {
        await connectDB();
        
        // Fetch balances for all wallets
        Logger.info('Fetching wallet balances...');
        const traderBalances: { address: string; balance: number }[] = [];
        
        // Fetch balances for target wallets (traders)
        for (const address of USER_ADDRESSES) {
            try {
                // Get trader's positions to calculate portfolio value
                const positionsUrl = `https://data-api.polymarket.com/positions?user=${address}`;
                const positions = await fetchData(positionsUrl);
                const portfolioValue = Array.isArray(positions)
                    ? positions.reduce((total: number, pos: any) => total + (pos.currentValue || 0), 0)
                    : 0;
                
                // Also get USDC balance
                const usdcBalance = await getMyBalance(address);
                const totalBalance = usdcBalance + portfolioValue;
                
                traderBalances.push({
                    address,
                    balance: totalBalance,
                });
            } catch (error) {
                // If we can't fetch balance, set to 0
                traderBalances.push({
                    address,
                    balance: 0,
                });
            }
        }
        
        // Fetch proxy wallet balance
        const myBalance = await getMyBalance(PROXY_WALLET);
        
        // Display startup UI
        await Logger.botStart(USER_ADDRESSES, traderBalances, PROXY_WALLET, myBalance);

        // Perform initial health check
        Logger.info('Performing initial health check...');
        const healthResult = await performHealthCheck();
        logHealthCheck(healthResult);

        if (!healthResult.healthy) {
            Logger.warning('Health check failed, but continuing startup...');
        }

        Logger.separator();
        Logger.info('Services loaded (execution disabled)');

    } catch (error) {
        Logger.error(`Fatal error during startup: ${error}`);
        await gracefulShutdown('startup-error');
    }
};

main();
