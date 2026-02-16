import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

class Logger {
    private static logsDir = path.join(process.cwd(), 'logs');
    private static currentLogFile = '';

    private static getLogFileName(): string {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return path.join(this.logsDir, `bot-${date}.log`);
    }

    private static ensureLogsDir(): void {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    private static writeToFile(message: string): void {
        try {
            this.ensureLogsDir();
            const logFile = this.getLogFileName();
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] ${message}\n`;
            fs.appendFileSync(logFile, logEntry, 'utf8');
        } catch (error) {
            // Silently fail to avoid infinite loops
        }
    }

    private static stripAnsi(str: string): string {
        // Remove ANSI color codes for file logging
        return str.replace(/\u001b\[\d+m/g, '');
    }

    private static formatAddress(address: string): string {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    private static maskAddress(address: string): string {
        // Show 0x and first 4 chars, mask middle, show last 4 chars
        return `${address.slice(0, 6)}${'*'.repeat(34)}${address.slice(-4)}`;
    }

    static header(title: string) {
        console.log('\n' + chalk.cyan('━'.repeat(70)));
        console.log(chalk.cyan.bold(`  ${title}`));
        console.log(chalk.cyan('━'.repeat(70)) + '\n');
        this.writeToFile(`HEADER: ${title}`);
    }

    static info(message: string) {
        console.log(chalk.blue('ℹ'), message);
        this.writeToFile(`INFO: ${message}`);
    }

    static success(message: string) {
        console.log(chalk.green('✓'), message);
        this.writeToFile(`SUCCESS: ${message}`);
    }

    static warning(message: string) {
        console.log(chalk.yellow('⚠'), message);
        this.writeToFile(`WARNING: ${message}`);
    }

    static error(message: string) {
        console.log(chalk.red('✗'), message);
        this.writeToFile(`ERROR: ${message}`);
    }

    static trade(traderAddress: string, action: string, details: any) {
        console.log('\n');
        console.log(chalk.magenta.bold('╔════════════════════════════════════════════════════════════════╗'));
        console.log(chalk.magenta.bold('║              🎯 TARGET WALLET TRADE DETECTED 🎯               ║'));
        console.log(chalk.magenta.bold('╚════════════════════════════════════════════════════════════════╝'));
        console.log('');
        
        // Trader info
        console.log(chalk.cyan.bold('👤 Trader:'));
        console.log(chalk.gray(`   ${this.formatAddress(traderAddress)}`));
        console.log('');
        
        // Trade details
        console.log(chalk.cyan.bold('📊 Trade Details:'));
        if (details.side) {
            const sideColor = details.side === 'BUY' ? chalk.green : chalk.red;
            const sideIcon = details.side === 'BUY' ? '📈' : '📉';
            console.log(chalk.gray(`   ${sideIcon} Side:   ${sideColor.bold(details.side)}`));
        }
        if (details.amount) {
            console.log(chalk.gray(`   💰 Amount: ${chalk.yellow.bold(`$${details.amount.toFixed(2)}`)}`));
        }
        if (details.price) {
            console.log(chalk.gray(`   💵 Price:  ${chalk.cyan.bold(`$${details.price.toFixed(4)}`)}`));
        }
        if (details.size) {
            console.log(chalk.gray(`   📦 Size:   ${chalk.white.bold(`${details.size.toFixed(2)} tokens`)}`));
        }
        console.log('');
        
        // Market info
        if (details.title || details.eventSlug || details.slug) {
            console.log(chalk.cyan.bold('🏪 Market:'));
            if (details.title) {
                const titleDisplay = details.title.length > 60 
                    ? details.title.substring(0, 57) + '...' 
                    : details.title;
                console.log(chalk.gray(`   ${titleDisplay}`));
            }
            if (details.eventSlug || details.slug) {
                const slug = details.eventSlug || details.slug;
                const marketUrl = `https://polymarket.com/event/${slug}`;
                console.log(chalk.gray(`   ${chalk.blue.underline(marketUrl)}`));
            }
            console.log('');
        }
        
        // Transaction
        if (details.transactionHash) {
            console.log(chalk.cyan.bold('🔗 Transaction:'));
            const txUrl = `https://polygonscan.com/tx/${details.transactionHash}`;
            console.log(chalk.gray(`   ${chalk.blue.underline(txUrl)}`));
            console.log('');
        }
        
        console.log(chalk.magenta('═'.repeat(70)));
        console.log('');

        // Log to file
        let tradeLog = `TRADE DETECTED: ${this.formatAddress(traderAddress)} - ${action}`;
        if (details.side) tradeLog += ` | Side: ${details.side}`;
        if (details.amount) tradeLog += ` | Amount: $${details.amount.toFixed(2)}`;
        if (details.price) tradeLog += ` | Price: ${details.price.toFixed(4)}`;
        if (details.title) tradeLog += ` | Market: ${details.title}`;
        if (details.transactionHash) tradeLog += ` | TX: ${details.transactionHash}`;
        this.writeToFile(tradeLog);
    }

    static balance(myBalance: number, traderBalance: number, traderAddress: string) {
        console.log(chalk.gray('Capital (USDC + Positions):'));
        console.log(
            chalk.gray(`  Your total capital:   ${chalk.green.bold(`$${myBalance.toFixed(2)}`)}`)
        );
        console.log(
            chalk.gray(
                `  Trader total capital: ${chalk.blue.bold(`$${traderBalance.toFixed(2)}`)} (${this.formatAddress(traderAddress)})`
            )
        );
    }

    static orderResult(success: boolean, message: string) {
        if (success) {
            console.log(chalk.green('✓'), chalk.green.bold('Order executed:'), message);
            this.writeToFile(`ORDER SUCCESS: ${message}`);
        } else {
            console.log(chalk.red('✗'), chalk.red.bold('Order failed:'), message);
            this.writeToFile(`ORDER FAILED: ${message}`);
        }
    }

    static copyTradeStart(
        traderAddress: string,
        traderTrade: { side: string; amount: number; price: number; title?: string },
        myOrder: { side: string; amount: number; price: number }
    ) {
        console.log('\n');
        console.log(chalk.cyan.bold('╔════════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan.bold('║                    🔄 COPYING TRADE 🔄                        ║'));
        console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝'));
        console.log('');

        // Trader's original trade
        console.log(chalk.yellow.bold('👤 Trader\'s Trade:'));
        console.log(chalk.gray(`   Address: ${this.formatAddress(traderAddress)}`));
        const sideColor = traderTrade.side === 'BUY' ? chalk.green : chalk.red;
        const sideIcon = traderTrade.side === 'BUY' ? '📈' : '📉';
        console.log(chalk.gray(`   ${sideIcon} Side:   ${sideColor.bold(traderTrade.side)}`));
        console.log(chalk.gray(`   💰 Amount: ${chalk.yellow.bold(`$${traderTrade.amount.toFixed(2)}`)}`));
        console.log(chalk.gray(`   💵 Price:  ${chalk.cyan.bold(`$${traderTrade.price.toFixed(4)}`)}`));
        if (traderTrade.title) {
            const titleDisplay = traderTrade.title.length > 50 
                ? traderTrade.title.substring(0, 47) + '...' 
                : traderTrade.title;
            console.log(chalk.gray(`   🏪 Market: ${titleDisplay}`));
        }
        console.log('');

        // Your copy trade
        console.log(chalk.magenta.bold('🤖 Your Copy Trade:'));
        const mySideColor = myOrder.side === 'BUY' ? chalk.green : chalk.red;
        const mySideIcon = myOrder.side === 'BUY' ? '📈' : '📉';
        console.log(chalk.gray(`   ${mySideIcon} Side:   ${mySideColor.bold(myOrder.side)}`));
        console.log(chalk.gray(`   💰 Amount: ${chalk.yellow.bold(`$${myOrder.amount.toFixed(2)}`)}`));
        console.log(chalk.gray(`   💵 Price:  ${chalk.cyan.bold(`$${myOrder.price.toFixed(4)}`)}`));
        
        // Show copy ratio
        const copyRatio = (myOrder.amount / traderTrade.amount) * 100;
        console.log(chalk.gray(`   📊 Copy:   ${chalk.blue.bold(`${copyRatio.toFixed(1)}%`)} of trader's trade`));
        console.log('');

        console.log(chalk.cyan('═'.repeat(70)));
        console.log('');

        // Log to file
        let copyLog = `COPYING TRADE: ${this.formatAddress(traderAddress)} | Trader: ${traderTrade.side} $${traderTrade.amount.toFixed(2)} | Your: ${myOrder.side} $${myOrder.amount.toFixed(2)} (${copyRatio.toFixed(1)}%)`;
        this.writeToFile(copyLog);
    }

    static copyTradeResult(
        success: boolean,
        traderAddress: string,
        details: {
            side: string;
            amount: number;
            tokens?: number;
            price: number;
            totalCost?: number;
            error?: string;
        }
    ) {
        console.log('\n');
        if (success) {
            console.log(chalk.green.bold('╔════════════════════════════════════════════════════════════════╗'));
            console.log(chalk.green.bold('║                  ✅ TRADE COPIED SUCCESSFULLY ✅                ║'));
            console.log(chalk.green.bold('╚════════════════════════════════════════════════════════════════╝'));
            console.log('');

            console.log(chalk.green.bold('📊 Execution Summary:'));
            const sideColor = details.side === 'BUY' ? chalk.green : chalk.red;
            const sideIcon = details.side === 'BUY' ? '📈' : '📉';
            console.log(chalk.gray(`   ${sideIcon} Side:        ${sideColor.bold(details.side)}`));
            console.log(chalk.gray(`   💰 Amount:      ${chalk.yellow.bold(`$${details.amount.toFixed(2)}`)}`));
            if (details.tokens) {
                console.log(chalk.gray(`   📦 Tokens:      ${chalk.white.bold(`${details.tokens.toFixed(2)}`)}`));
            }
            console.log(chalk.gray(`   💵 Price:       ${chalk.cyan.bold(`$${details.price.toFixed(4)}`)}`));
            if (details.totalCost) {
                console.log(chalk.gray(`   💳 Total Cost:  ${chalk.yellow.bold(`$${details.totalCost.toFixed(2)}`)}`));
            }
            console.log(chalk.gray(`   👤 Copied from: ${this.formatAddress(traderAddress)}`));
            console.log('');

            console.log(chalk.green('═'.repeat(70)));
            console.log('');

            // Log to file
            let successLog = `TRADE COPIED SUCCESS: ${this.formatAddress(traderAddress)} | ${details.side} $${details.amount.toFixed(2)} @ $${details.price.toFixed(4)}`;
            if (details.tokens) successLog += ` | ${details.tokens.toFixed(2)} tokens`;
            this.writeToFile(successLog);
        } else {
            console.log(chalk.red.bold('╔════════════════════════════════════════════════════════════════╗'));
            console.log(chalk.red.bold('║                    ❌ TRADE COPY FAILED ❌                     ║'));
            console.log(chalk.red.bold('╚════════════════════════════════════════════════════════════════╝'));
            console.log('');

            console.log(chalk.red.bold('❌ Failure Details:'));
            const sideColor = details.side === 'BUY' ? chalk.green : chalk.red;
            console.log(chalk.gray(`   Side:        ${sideColor.bold(details.side)}`));
            console.log(chalk.gray(`   Amount:      ${chalk.yellow(`$${details.amount.toFixed(2)}`)}`));
            console.log(chalk.gray(`   Price:       ${chalk.cyan(`$${details.price.toFixed(4)}`)}`));
            if (details.error) {
                console.log(chalk.gray(`   Error:       ${chalk.red(details.error)}`));
            }
            console.log(chalk.gray(`   Trader:      ${this.formatAddress(traderAddress)}`));
            console.log('');

            console.log(chalk.red('═'.repeat(70)));
            console.log('');

            // Log to file
            let failLog = `TRADE COPY FAILED: ${this.formatAddress(traderAddress)} | ${details.side} $${details.amount.toFixed(2)} @ $${details.price.toFixed(4)}`;
            if (details.error) failLog += ` | Error: ${details.error}`;
            this.writeToFile(failLog);
        }
    }

    static monitoring(traderCount: number) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(
            chalk.dim(`[${timestamp}]`),
            chalk.cyan('👁️  Monitoring'),
            chalk.yellow(`${traderCount} trader(s)`)
        );
    }

    static startup(traders: string[], myWallet: string) {
        console.log('\n');
        // ASCII Art Logo with gradient colors
        console.log(chalk.cyan('  ____       _        ____                 '));
        console.log(chalk.cyan(' |  _ \\ ___ | |_   _ / ___|___  _ __  _   _ '));
        console.log(chalk.cyan.bold(" | |_) / _ \\| | | | | |   / _ \\| '_ \\| | | |"));
        console.log(chalk.magenta.bold(' |  __/ (_) | | |_| | |__| (_) | |_) | |_| |'));
        console.log(chalk.magenta(' |_|   \\___/|_|\\__, |\\____\\___/| .__/ \\__, |'));
        console.log(chalk.magenta('               |___/            |_|    |___/ '));
        console.log(chalk.gray('               Copy the best, automate success\n'));

        console.log(chalk.cyan('━'.repeat(70)));
        console.log(chalk.cyan('📊 Tracking Traders:'));
        traders.forEach((address, index) => {
            console.log(chalk.gray(`   ${index + 1}. ${address}`));
        });
        console.log(chalk.cyan(`\n💼 Your Wallet:`));
        console.log(chalk.gray(`   ${this.maskAddress(myWallet)}\n`));
    }

    static async botStart(
        traders: string[],
        traderBalances: { address: string; balance: number }[],
        myWallet: string,
        myBalance: number
    ) {
        console.clear();
        console.log('\n');
        
        // Main header
        console.log(chalk.cyan.bold('╔════════════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan.bold('║              🚀 POLYMARKET BOT START 🚀                        ║'));
        console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝'));
        console.log('');

        // Target Wallets Section
        console.log(chalk.yellow.bold('🎯 TARGET WALLETS (Traders to Copy)'));
        console.log(chalk.yellow('─'.repeat(70)));
        if (traders.length === 0) {
            console.log(chalk.red('   ⚠️  No target wallets configured!'));
        } else {
            traders.forEach((address, index) => {
                const traderInfo = traderBalances.find((t) => t.address.toLowerCase() === address.toLowerCase());
                const balance = traderInfo ? traderInfo.balance : 0;
                const balanceColor = balance > 0 ? chalk.green : chalk.red;
                const balanceStr = balance > 0 ? `$${balance.toFixed(2)}` : '$0.00';
                
                console.log(chalk.gray(`   ${index + 1}. ${chalk.cyan(this.formatAddress(address))}`));
                console.log(chalk.gray(`      Balance: ${balanceColor.bold(balanceStr)}`));
            });
        }
        console.log('');

        // Proxy Wallet Section
        console.log(chalk.magenta.bold('💼 PROXY WALLET (Your Trading Wallet)'));
        console.log(chalk.magenta('─'.repeat(70)));
        console.log(chalk.gray(`   Address: ${chalk.cyan(this.formatAddress(myWallet))}`));
        const myBalanceColor = myBalance > 0 ? chalk.green : chalk.red;
        const myBalanceStr = myBalance > 0 ? `$${myBalance.toFixed(2)}` : '$0.00';
        console.log(chalk.gray(`   Balance: ${myBalanceColor.bold(myBalanceStr)}`));
        
        if (myBalance === 0) {
            console.log(chalk.yellow('   ⚠️  Warning: Zero balance! Add USDC to start trading.'));
        }
        console.log('');

        // Status
        console.log(chalk.cyan.bold('📊 STATUS'));
        console.log(chalk.cyan('─'.repeat(70)));
        console.log(chalk.gray(`   Monitoring: ${chalk.green.bold(`${traders.length} trader(s)`)}`));
        console.log(chalk.gray(`   Ready: ${chalk.green.bold('✓')} Waiting for trades...`));
        console.log('');

        // Separator
        console.log(chalk.dim('═'.repeat(70)));
        console.log('');
    }

    static dbConnection(traders: string[], counts: number[]) {
        console.log('\n' + chalk.cyan('📦 Database Status:'));
        traders.forEach((address, index) => {
            const countStr = chalk.yellow(`${counts[index]} trades`);
            console.log(chalk.gray(`   ${this.formatAddress(address)}: ${countStr}`));
        });
        console.log('');
    }

    static separator() {
        console.log(chalk.dim('─'.repeat(70)));
    }

    private static spinnerFrames = ['⏳', '⌛', '⏳'];
    private static spinnerIndex = 0;

    static waiting(traderCount: number, extraInfo?: string) {
        const timestamp = new Date().toLocaleTimeString();
        const spinner = this.spinnerFrames[this.spinnerIndex % this.spinnerFrames.length];
        this.spinnerIndex++;

        const message = extraInfo
            ? `${spinner} Waiting for trades from ${traderCount} trader(s)... (${extraInfo})`
            : `${spinner} Waiting for trades from ${traderCount} trader(s)...`;

        process.stdout.write(chalk.dim(`\r[${timestamp}] `) + chalk.cyan(message) + '  ');
    }

    static clearLine() {
        process.stdout.write('\r' + ' '.repeat(100) + '\r');
    }

    static myPositions(
        wallet: string,
        count: number,
        topPositions: any[],
        overallPnl: number,
        totalValue: number,
        initialValue: number,
        currentBalance: number
    ) {
        console.log('\n' + chalk.magenta.bold('💼 YOUR POSITIONS'));
        console.log(chalk.gray(`   Wallet: ${this.formatAddress(wallet)}`));
        console.log('');

        // Show balance and portfolio overview
        const balanceStr = chalk.yellow.bold(`$${currentBalance.toFixed(2)}`);
        const totalPortfolio = currentBalance + totalValue;
        const portfolioStr = chalk.cyan.bold(`$${totalPortfolio.toFixed(2)}`);

        console.log(chalk.gray(`   💰 Available Cash:    ${balanceStr}`));
        console.log(chalk.gray(`   📊 Total Portfolio:   ${portfolioStr}`));

        if (count === 0) {
            console.log(chalk.gray(`\n   No open positions`));
        } else {
            const countStr = chalk.green(`${count} position${count > 1 ? 's' : ''}`);
            const pnlColor = overallPnl >= 0 ? chalk.green : chalk.red;
            const pnlSign = overallPnl >= 0 ? '+' : '';
            const profitStr = pnlColor.bold(`${pnlSign}${overallPnl.toFixed(1)}%`);
            const valueStr = chalk.cyan(`$${totalValue.toFixed(2)}`);
            const initialStr = chalk.gray(`$${initialValue.toFixed(2)}`);

            console.log('');
            console.log(chalk.gray(`   📈 Open Positions:    ${countStr}`));
            console.log(chalk.gray(`      Invested:          ${initialStr}`));
            console.log(chalk.gray(`      Current Value:     ${valueStr}`));
            console.log(chalk.gray(`      Profit/Loss:       ${profitStr}`));

            // Show top positions
            if (topPositions.length > 0) {
                console.log(chalk.gray(`\n   🔝 Top Positions:`));
                topPositions.forEach((pos: any) => {
                    const pnlColor = pos.percentPnl >= 0 ? chalk.green : chalk.red;
                    const pnlSign = pos.percentPnl >= 0 ? '+' : '';
                    const avgPrice = pos.avgPrice || 0;
                    const curPrice = pos.curPrice || 0;
                    console.log(
                        chalk.gray(
                            `      • ${pos.outcome} - ${pos.title.slice(0, 45)}${pos.title.length > 45 ? '...' : ''}`
                        )
                    );
                    console.log(
                        chalk.gray(
                            `        Value: ${chalk.cyan(`$${pos.currentValue.toFixed(2)}`)} | PnL: ${pnlColor(`${pnlSign}${pos.percentPnl.toFixed(1)}%`)}`
                        )
                    );
                    console.log(
                        chalk.gray(
                            `        Bought @ ${chalk.yellow(`${(avgPrice * 100).toFixed(1)}¢`)} | Current @ ${chalk.yellow(`${(curPrice * 100).toFixed(1)}¢`)}`
                        )
                    );
                });
            }
        }
        console.log('');
    }

    static tradersPositions(
        traders: string[],
        positionCounts: number[],
        positionDetails?: any[][],
        profitabilities?: number[]
    ) {
        console.log('\n' + chalk.cyan("📈 TRADERS YOU'RE COPYING"));
        traders.forEach((address, index) => {
            const count = positionCounts[index];
            const countStr =
                count > 0
                    ? chalk.green(`${count} position${count > 1 ? 's' : ''}`)
                    : chalk.gray('0 positions');

            // Add profitability if available
            let profitStr = '';
            if (profitabilities && profitabilities[index] !== undefined && count > 0) {
                const pnl = profitabilities[index];
                const pnlColor = pnl >= 0 ? chalk.green : chalk.red;
                const pnlSign = pnl >= 0 ? '+' : '';
                profitStr = ` | ${pnlColor.bold(`${pnlSign}${pnl.toFixed(1)}%`)}`;
            }

            console.log(chalk.gray(`   ${this.formatAddress(address)}: ${countStr}${profitStr}`));

            // Show position details if available
            if (positionDetails && positionDetails[index] && positionDetails[index].length > 0) {
                positionDetails[index].forEach((pos: any) => {
                    const pnlColor = pos.percentPnl >= 0 ? chalk.green : chalk.red;
                    const pnlSign = pos.percentPnl >= 0 ? '+' : '';
                    const avgPrice = pos.avgPrice || 0;
                    const curPrice = pos.curPrice || 0;
                    console.log(
                        chalk.gray(
                            `      • ${pos.outcome} - ${pos.title.slice(0, 40)}${pos.title.length > 40 ? '...' : ''}`
                        )
                    );
                    console.log(
                        chalk.gray(
                            `        Value: ${chalk.cyan(`$${pos.currentValue.toFixed(2)}`)} | PnL: ${pnlColor(`${pnlSign}${pos.percentPnl.toFixed(1)}%`)}`
                        )
                    );
                    console.log(
                        chalk.gray(
                            `        Bought @ ${chalk.yellow(`${(avgPrice * 100).toFixed(1)}¢`)} | Current @ ${chalk.yellow(`${(curPrice * 100).toFixed(1)}¢`)}`
                        )
                    );
                });
            }
        });
        console.log('');
    }
}

export default Logger;
