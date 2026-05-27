router.post('/', async (req, res) => {
  try {
    const buffer = await docxService.generateDoc(req.body);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${req.body.fileName || 'document.docx'}`
    );

    res.send(buffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});