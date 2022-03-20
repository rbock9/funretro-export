const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { exit } = require('process');

const [url, file] = process.argv.slice(2);

if (!url) {
    throw 'Please provide a URL as the first argument.';
}

async function run() {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto(url);
    await page.waitForSelector('.easy-card-list');

    const boardTitle = await page.$eval('.board-name', (node) => node.innerText.trim().split(" ").join(''));

    if (!boardTitle) {
        throw 'Board title does not exist. Please check if provided URL is correct.'
    }

    const fileDetails = {
        title: boardTitle,
        text: null
    }

    let parsedText = "";

    const columns = await page.$$('.easy-card-list');
    
    for (let i = 0; i < columns.length; i++) {
        const columnTitle = await columns[i].$eval('.column-header', (node) => node.innerText.trim()); 
        if (i === columns.length - 1) {
            parsedText += columnTitle;
        } else {
            parsedText += columnTitle + ",";
        }
    }
    parsedText += "\n";

    let boardColumns = [];

    for (let i = 0; i < columns.length; i++) {
        const messages = await columns[i].$$('.easy-board-front');
        let boardColumn = [];
        for (let i = 0; i < messages.length; i++) {
            const messageText = await messages[i].$eval('.easy-card-main .easy-card-main-content .text', (node) => node.innerText.trim());
            const votes = await messages[i].$eval('.easy-card-votes-container .easy-badge-votes', (node) => node.innerText.trim());
            let boardCard = {message: messageText, votes: votes};
            boardColumn.push(boardCard);
        }
        boardColumns.push(boardColumn);
    }

    let maxColumnLength = 0;

    boardColumns.forEach(boardColumn => {
        if (boardColumn.length > maxColumnLength) {
            maxColumnLength = boardColumn.length;
        }
    })

    for (let i = 0; i < maxColumnLength; i++) {
        boardColumns.forEach((boardColumn, index) => {
            if (boardColumn.length > i) {
                if (boardColumn[i].votes > 0) {
                    parsedText += `"${boardColumn[i].message}"`;
                }
            }
            if (boardColumns.length !== index + 1) {
                parsedText += ",";
            }
        })
        parsedText += "\n";
    }

    fileDetails.text = parsedText;
    return fileDetails;
}

function writeToFile(filePath, data) {
    const resolvedPath = path.resolve(filePath || `../${data.split('\n')[0].replace('/', '')}.txt`);
    fs.writeFile(resolvedPath, data, (error) => {
        if (error) {
            throw error;
        } else {
            console.log(`Successfully written to file at: ${resolvedPath}`);
        }
        process.exit();
    });
}

function handleError(error) {
    console.error(error);
}

run().then((data) => writeToFile(file, data.text)).catch(handleError);