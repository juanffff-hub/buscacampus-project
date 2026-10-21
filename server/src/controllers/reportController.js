const ApiError = require('../errors/ApiError');
const reportService = require('../services/reportService');
const {
  reportIdSchema,
  listReportsSchema,
  createReportSchema,
  updateReportSchema,
} = require('../schemas/reportSchemas');
const { sendSuccess } = require('../utils/responses');
const { deleteUploadedFile } = require('../middleware/reportUpload');

async function list(req, res) {
  const filters = listReportsSchema.parse(req.query);
  const result = await reportService.listReports(filters, req.user?.id);
  return sendSuccess(res, result);
}

async function getById(req, res) {
  const id = reportIdSchema.parse(req.params.id);
  const report = await reportService.getReport(id);
  if (!report) throw new ApiError(404, 'REPORT_NOT_FOUND', 'El reporte solicitado no existe.');
  return sendSuccess(res, { report });
}

async function create(req, res) {
  try {
    const input = createReportSchema.parse(req.body);
    if (!req.file) {
      throw new ApiError(400, 'IMAGE_REQUIRED', 'Debes adjuntar una imagen al reporte.');
    }

    const report = await reportService.createReport(input, req.file, req.user.id);
    return sendSuccess(res, { report }, 201);
  } catch (error) {
    if (req.file) {
      try {
        await deleteUploadedFile(req.file.filename);
      } catch {
        // Preserve validation/transaction errors without returning filesystem details.
      }
    }
    throw error;
  }
}

async function update(req, res) {
  try {
    const id = reportIdSchema.parse(req.params.id);
    const input = updateReportSchema.parse(req.body);
    const report = await reportService.updateReport(id, input, req.file, req.user);
    return sendSuccess(res, { report });
  } catch (error) {
    if (req.file) {
      try {
        await deleteUploadedFile(req.file.filename);
      } catch {
        // Preserve validation/authorization errors without returning filesystem details.
      }
    }
    throw error;
  }
}

async function remove(req, res) {
  const id = reportIdSchema.parse(req.params.id);
  await reportService.deleteReport(id, req.user);
  return res.status(204).end();
}

module.exports = { list, getById, create, update, remove };
