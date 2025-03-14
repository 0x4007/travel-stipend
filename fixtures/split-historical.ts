import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises';
import { join } from 'path';

interface DailyTransactions {
    [key: string]: string[];
}

function parseDate(dateStr: string): string | null {
    // Try MM/DD/YYYY format with or without leading zeros
    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const result = dateRegex.exec(dateStr);

    if (result) {
        const [, month, day, year] = result;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
}

async function processTransaction(transaction: string): Promise<[string, string] | null> {
    const fields = transaction.split(',');
    if (!fields[0]) return null;

    const folderDate = parseDate(fields[0]);
    if (!folderDate) return null;

    return [folderDate, transaction];
}

async function groupTransactionsByDay(transactions: string[]): Promise<DailyTransactions> {
    const dailyTransactions: DailyTransactions = {};

    for (const transaction of transactions) {
        const result = await processTransaction(transaction);
        if (!result) continue;

        const [folderDate, transactionData] = result;
        if (!dailyTransactions[folderDate]) {
            dailyTransactions[folderDate] = [];
        }
        dailyTransactions[folderDate].push(transactionData);
    }

    return dailyTransactions;
}

async function writeDailyFiles(baseDir: string, dailyTransactions: DailyTransactions, header: string, csvFile: string) {
    for (const [date, transactions] of Object.entries(dailyTransactions)) {
        const dailyDir = join(baseDir, date);
        await mkdir(dailyDir, { recursive: true });

        const dailyCsv = [header, ...transactions].join('\n');
        await writeFile(join(dailyDir, csvFile), dailyCsv);
    }
}

async function processCsvFile(monthPath: string, csvFile: string, baseDir: string) {
    const csvPath = join(monthPath, csvFile);
    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    const header = lines[0];
    const transactions = lines.slice(1).filter(line => line.trim());

    const dailyTransactions = await groupTransactionsByDay(transactions);
    await writeDailyFiles(baseDir, dailyTransactions, header, csvFile);
}

async function isDirectory(path: string): Promise<boolean> {
    try {
        const stats = await stat(path);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

async function splitHistoricalData() {
    try {
        const baseDir = 'historical';
        const entries = await readdir(baseDir);

        // Filter out non-directory entries
        const monthDirs: string[] = [];
        for (const entry of entries) {
            const fullPath = join(baseDir, entry);
            if (await isDirectory(fullPath)) {
                monthDirs.push(entry);
            }
        }

        for (const monthDir of monthDirs) {
            const monthPath = join(baseDir, monthDir);
            const files = await readdir(monthPath);
            const csvFiles = files.filter(file => file.endsWith('.csv'));

            for (const csvFile of csvFiles) {
                await processCsvFile(monthPath, csvFile, baseDir);
            }
        }

        console.log('Successfully split historical data into daily files');
    } catch (error) {
        console.error('Error splitting historical data:', error);
    }
}

void (async () => {
    try {
        await splitHistoricalData();
    } catch (error) {
        console.error('Error in main execution:', error);
        process.exit(1);
    }
})();
