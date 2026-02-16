import Logger from '../utils/logger';

// Track if monitor should continue running
let isRunning = true;

/**
 * Stop the trade monitor gracefully
 */
export const stopTradeMonitor = () => {
    isRunning = false;
    Logger.info('Trade monitor shutdown requested...');
};

const tradeMonitor = async () => {
    Logger.info('Trade monitor loaded (monitoring disabled)');

    while (isRunning) {
        if (!isRunning) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    Logger.info('Trade monitor stopped');
};

export default tradeMonitor;
