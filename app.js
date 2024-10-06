const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ensure 'modified' directory exists
const modifiedDir = path.join(__dirname, 'modified');
if (!fs.existsSync(modifiedDir)) {
  fs.mkdirSync(modifiedDir);
}

// Serve the form to upload HTML file and enter the array of words
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'form.html'));
});

// Handle file upload and process the HTML
app.post('/upload', upload.single('htmlFile'), (req, res) => {
  const wordsArray = req.body.words
    .split(',')
    .map(word => word.trim().toLowerCase())
    .filter(word => word.length > 0); // Remove any empty strings

  if (wordsArray.length === 0) {
    return res.status(400).send('No valid words provided for filtering.');
  }

  const filePath = req.file.path;

  // Read the HTML file
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading the file:', err);
      return res.status(500).send('Error reading the file.');
    }

    // Load the HTML into cheerio for parsing
    const $ = cheerio.load(data);

    // Create a regex pattern to match any of the words as whole words, case-insensitive
    const regex = new RegExp(`\\b(${wordsArray.join('|')})\\b`, 'i');

    console.log('Words to filter:', wordsArray);
    console.log('Regex pattern:', regex);

    // Define tags to exclude from removal to preserve HTML structure
    const excludeTags = ['html', 'head', 'body', 'title', 'meta'];

    // Find and remove elements containing any of the words
    $('*').each(function () {
      const element = $(this);
      const tagName = element[0].tagName.toLowerCase();

      // Skip excluded tags
      if (excludeTags.includes(tagName)) {
        return;
      }

      const tagContent = element.text().toLowerCase();

      if (regex.test(tagContent)) {
        console.log(`Removing tag: <${tagName}> with content: "${element.text()}"`);
        element.remove();
      }
    });

    // Write the modified HTML back to a file
    const modifiedHtml = $.html();
    const timestamp = Date.now();
    const modifiedFileName = `output_${timestamp}.html`;
    const modifiedFilePath = path.join(modifiedDir, modifiedFileName);

    fs.writeFile(modifiedFilePath, modifiedHtml, (err) => {
      if (err) {
        console.error('Error writing the modified file:', err);
        return res.status(500).send('Error writing the modified file.');
      }

      // Provide a unique download link for each processed file
      res.send(`
        <h2>File processed successfully!</h2>
        <p><a href="/download/${modifiedFileName}">Download Modified HTML</a></p>
        <p><a href="/">Process Another File</a></p>
      `);
    });
  });
});

// Serve the modified file for download
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const file = path.join(__dirname, 'modified', filename);

  // Check if the file exists
  fs.access(file, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('File not found.');
    }

    res.download(file, (err) => {
      if (err) {
        console.error('Error sending the file:', err);
        res.status(500).send('Error downloading the file.');
      }
    });
  });
});

// Start the server on localhost
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
