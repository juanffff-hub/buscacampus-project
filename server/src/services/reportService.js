const reportRepository = require('../repositories/reportRepository');
const ApiError = require('../errors/ApiError');
const path = require('node:path');
const {
  deleteUploadedFile,
  sanitizeOriginalName,
} = require('../middleware/reportUpload');

function toPublicReport(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    tipoReporte: row.tipoReporte,
    estado: row.estado,
    fechaHoraEvento: row.fechaHoraEvento,
    fechaCreacion: row.fechaCreacion,
    autor: {
      id: row.autorId,
      nombreCompleto: row.autorNombre,
    },
    categoria: {
      id: row.categoriaId,
      nombre: row.categoriaNombre,
    },
    ubicacion: {
      id: row.ubicacionId,
      nombre: row.ubicacionNombre,
    },
    imagen: row.imagenId ? {
      id: row.imagenId,
      nombreOriginal: row.imagenNombreOriginal,
      nombreFisico: row.imagenNombreFisico,
      url: row.imagenUrl,
      mimeType: row.imagenMimeType,
      extension: row.imagenExtension,
      pesoBytes: Number(row.imagenPesoBytes),
      fechaSubida: row.imagenFechaSubida,
    } : null,
  };
}

async function listReports(filters, userId) {
  const result = await reportRepository.listReports(filters, userId);
  return {
    items: result.rows.map(toPublicReport),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / filters.limit),
    },
  };
}

async function getReport(id) {
  const row = await reportRepository.findReportById(id);
  return row ? toPublicReport(row) : null;
}

async function createReport(input, uploadedFile, userId) {
  const file = {
    originalName: sanitizeOriginalName(uploadedFile.originalname),
    filename: uploadedFile.filename,
    mimeType: uploadedFile.mimetype,
    extension: path.extname(uploadedFile.filename),
    size: uploadedFile.size,
  };

  try {
    const row = await reportRepository.createReport(input, file, userId);
    return toPublicReport(row);
  } catch (error) {
    try {
      await deleteUploadedFile(uploadedFile.filename);
    } catch {
      // Preserve the database failure; the API response never exposes paths.
    }

    if (error.code === '23503') {
      throw new ApiError(400, 'INVALID_REFERENCE', 'La categoría o ubicación seleccionada no existe.');
    }
    throw error;
  }
}

module.exports = { listReports, getReport, createReport, toPublicReport };
