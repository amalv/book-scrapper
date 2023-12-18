import { parse, format } from "date-fns";
import axios from "axios";
import { JSDOM } from "jsdom";
import fs from "fs";
import dotenv from "dotenv";
import ProgressBar from "progress";

dotenv.config();

interface Book {
  title: string | null;
  author: string | null;
  image: string;
  publicationDate: string;
  rating: number | null;
  ratingsCount: number | null;
}

async function scrapeBook(bookElement: Element): Promise<Book | null> {
  const titleElement = bookElement.querySelector(".bookTitle span");
  const authorElement = bookElement.querySelector(".authorName span");
  const ratingElement = bookElement.querySelector(".minirating");
  const linkElement = bookElement.querySelector(".bookTitle");

  const title = titleElement ? titleElement.textContent : null;
  const author = authorElement ? authorElement.textContent : null;
  let image = "";
  let publicationDate = "";

  if (title && linkElement) {
    try {
      const googleBooksResponse = await axios.get(
        `https://www.googleapis.com/books/v1/volumes?q=intitle:${title}`
      );
      if (
        googleBooksResponse.data.items &&
        googleBooksResponse.data.items.length > 0
      ) {
        image =
          googleBooksResponse.data.items[0].volumeInfo.imageLinks.thumbnail;
      }

      // Follow the link to the book's page
      const bookPageResponse = await axios.get(
        `https://www.goodreads.com${linkElement.getAttribute("href")}`
      );
      const dom = new JSDOM(bookPageResponse.data);
      const publicationInfoElement = dom.window.document.querySelector(
        'p[data-testid="publicationInfo"]'
      );
      if (publicationInfoElement) {
        const publicationInfoText = publicationInfoElement.textContent;
        if (publicationInfoText) {
          const match = publicationInfoText.match(/First published ([\w\s,]+)/);
          if (match) {
            const date = parse(match[1], "MMMM d, yyyy", new Date());
            publicationDate = format(date, "yyyy-MM-dd");
          }
        }
      }
    } catch (error) {
      console.error(
        `Failed to fetch image for book "${title}": ${(error as Error).message}`
      );
      return null;
    }
  }

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

  return { title, author, image, publicationDate, rating, ratingsCount };
}

async function scrapeBooks(url: string) {
  const response = await axios.get(url);
  const dom = new JSDOM(response.data);

  const bookElements = dom.window.document.querySelectorAll(
    "tr[itemtype='http://schema.org/Book']"
  );
  const books: Book[] = [];
  const bar = new ProgressBar(":bar :percent", { total: bookElements.length });

  for (const bookElement of Array.from(bookElements)) {
    const book = await scrapeBook(bookElement);
    if (book) {
      books.push(book);
    }
    bar.tick();
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
  }

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
