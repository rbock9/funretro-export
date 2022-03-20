const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { exit } = require('process');

const [url] = process.argv.slice(2);

if (!url) {
    throw 'Please provide a URL as the first argument.';
}

// The 'run' function grabs the content of the team's Easy Retro board, separates the board title and text content, reformats the title and text content per the Acceptance Criteria, then returns an object which stores the reformatted title and text content as strings
async function run() {
    // Using chromium to access the url provided as an argument
    const browser = await chromium.launch();
    const page = await browser.newPage();
    // Once the page loads, we'll grab the easy-card-list dom elements, which hold the data we need
    await page.goto(url);
    await page.waitForSelector('.easy-card-list');

    // Grab the board name from the DOM element, trim spaces, split into an array and join array values so we end up with a string holding the title of the board without spaces (this string will be used later as the CSV file name)
    const boardTitle = await page.$eval('.board-name', (node) => node.innerText.trim().split(" ").join(''));
    // If statement makes sure the board has a title
    if (!boardTitle) {
        throw 'Board title does not exist. Please check if provided URL is correct.'
    }
    // This is the object we'll return at the end of the function, it will contain the CSV file name and the text content
    const fileDetails = {
        title: boardTitle,
        text: null
    }

    // This is the string variable we'll use to hold the board content, including column titles and cards, structured per the Acceptance Criteria
    let parsedText = "";

    // This variable holds the card columns grabbed from the website
    const columns = await page.$$('.easy-card-list');
    
    // This for loop loops through the columns, grabs the title of each column, and adds the column titles to the parsedText variable
    for (let i = 0; i < columns.length; i++) {
        const columnTitle = await columns[i].$eval('.column-header', (node) => node.innerText.trim()); 
        // We use an if statement to add a comma after each column title until the last title -- after the last column title, we do not add a comma, to adhere to csv file structure requirements
        if (i === columns.length - 1) {
            parsedText += columnTitle;
        } else {
            parsedText += columnTitle + ",";
        }
    }
    // Now that all the headers have been added to the parsedText string, we add a newline, per csv file structure requirements
    parsedText += "\n";

    // We'll declare boardColumns as an empty array, which will contain an array of all the board columns and their text/vote data (an array of arrays)
    let boardColumns = [];

    //  Now we're looping through all the columns one-by-one, so we can extract the text and vote data from all the cards 
    for (let i = 0; i < columns.length; i++) {
        // This variable holds the card messages containers grabbed from the website
        const messages = await columns[i].$$('.easy-board-front');
        // We'll declare board Column as an empty array, to hold all the cards in a given column
        let boardColumn = [];
        // Now we're doing another for loop to iterate through each message within each column
        for (let i = 0; i < messages.length; i++) {
            // This variable holds the text/message content of a given card
            const messageText = await messages[i].$eval('.easy-card-main .easy-card-main-content .text', (node) => node.innerText.trim());
            // This variable holds the votes content of a given card
            const votes = await messages[i].$eval('.easy-card-votes-container .easy-badge-votes', (node) => node.innerText.trim());
            // We'll store the text/message and the vote data in an object for easy reference
            let boardCard = {message: messageText, votes: votes};
            // Now we push the board card objects into a board Column array
            boardColumn.push(boardCard);
        }
        // Now we're pushing every board column array into a board columns array. 
        boardColumns.push(boardColumn);
    }
    // Now we have an array of all the Board Columns, and every Board Column is itself an array which holds objects containing the card data within each column. 

    // This next part is tricky: we need to put all the card data into one long csv-structured string. So, we'll need to loop through all the Board Column arrays, extracting the object data and putting the data into rows. 
    
    // Since we need to loop through to the end of every column, we first need to figure out how long the longest column is. We start by creating a maxColumnLength variable and setting it to zero.
    let maxColumnLength = 0;

    // Now we're calling the forEach method on each board column in the board columns array
    boardColumns.forEach(boardColumn => {
        // For each board column array that has a length greater than zero, we'll check if the "maxColumnLength" variable is a longer length than that board column array. If the board column length is bigger than the max column length number, then the max column length number is changed to the length of the board column length. After looking through all the columns, the maxColumnLength variable will hold a number representing the length of the longest array.
        if (boardColumn.length > maxColumnLength) {
            maxColumnLength = boardColumn.length;
        }
    })
    // Time to loop through all the board columns and push the board column data into csv-structured rows. And we now know the length of the longest column (it's stored in the maxColumnLength variable), so we can tell our for loop when to stop.
    for (let i = 0; i < maxColumnLength; i++) {
        // For each board column in the board columns array, iterating from 0 until the end of the longest board column array...
        boardColumns.forEach((boardColumn, index) => {
            // If the board column length is the same or bigger than the loop iteration number...
            if (boardColumn.length > i) {
                // And if the boardCard object in each board column has more than zero votes..
                if (boardColumn[i].votes > 0) {
                    // We'll add the message from the boardCard object into the parsed Text string
                    parsedText += `"${boardColumn[i].message}"`;
                }
            }
            // Until we reach the end of each boardColumn, we'll add a comma after every message value. Once we're actually at the end of each board Column, we will not add a comma
            if (boardColumns.length !== index + 1) {
                parsedText += ",";
            }
        })
        // Once [i] has been accessed for every column, the row will be complete, and we'll add a newline character to the parsedText string before the next row starts
        parsedText += "\n";
    }
    // We finally have all the parsed text saved in the parsedText variable! Now we'll put this text into the fileDetails object, which we'll export at the end of the function
    fileDetails.text = parsedText;
    // The function has done what we want it to! We'll return the fileDetails object so it can be used to provide necessary data for the writeToFile function
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

run().then((data) => writeToFile(data.title, data.text)).catch(handleError);