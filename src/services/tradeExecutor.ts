import Logger from '../utils/logger';

// Track if executor should continue running
let isRunning = true;

/**
 * Stop the trade executor gracefully
 */
export const stopTradeExecutor = () => {
    isRunning = false;
    Logger.info('Trade executor shutdown requested...');
};

const tradeExecutor = async () => {
    Logger.info('Trade executor loaded (execution disabled)');

    while (isRunning) {
        if (!isRunning) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    Logger.info('Trade executor stopped');
};

export default tradeExecutor;
