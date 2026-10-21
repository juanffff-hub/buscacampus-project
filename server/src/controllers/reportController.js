const ApiError = require('../errors/ApiError');
const reportService = require('../services/reportService');
const { reportIdSchema, listReportsSchema } = require('../schemas/reportSchemas');
const { sendSuccess } = require('../utils/responses');

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

module.exports = { list, getById };
