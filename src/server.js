require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { generateDocx } = require('./services/docxService');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/generate', async (req, res) => {
  try {
    const buffer = await generateDocx(req.body);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=test.docx'
    );

    res.send(buffer);

  } catch (err) {
    console.error(err);
    const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});