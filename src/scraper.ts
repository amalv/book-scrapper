import axios from "axios";
import { JSDOM } from "jsdom";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

async function scrapeBooks(url: string) {
  const response = await axios.get(url);
  const dom = new JSDOM(response.data);

  const bookElements = dom.window.document.querySelectorAll(
    "tr[itemtype='http://schema.org/Book']"
  );
  const books = Array.from(bookElements).map((bookElement) => {
    const titleElement = bookElement.querySelector(".bookTitle span");
    const authorElement = bookElement.querySelector(".authorName span");
    const ratingElement = bookElement.querySelector(".minirating");

    const title = titleElement ? titleElement.textContent : null;
    const author = authorElement ? authorElement.textContent : null;
    const image = ""; // Set image to an empty string
    let rating = null;
    let ratingsCount = null;
    if (ratingElement && ratingElement.textContent) {
      const ratingText = ratingElement.textContent;
      const match = ratingText.match(
        /(\d+\.\d+) avg rating — (\d+(?:,\d+)*) ratings/
      );
      if (match) {
        rating = Math.round(parseFloat(match[1]) * 20); // Convert rating to 0-100 scale and round to an integer
        ratingsCount = parseInt(match[2].replace(/,/g, ""));
      }
    }

    return { title, author, image, rating, ratingsCount };
  });

  return books;
}

async function main() {
  const url = process.env.BOOKS_URL;
  if (!url) {
    throw new Error("BOOKS_URL must be set in the .env file");
  }
  const books = await scrapeBooks(url);
  fs.writeFileSync("books.json", JSON.stringify(books, null, 2));
}

main();
