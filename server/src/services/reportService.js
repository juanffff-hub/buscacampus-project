const reportRepository = require('../repositories/reportRepository');

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

module.exports = { listReports, getReport, toPublicReport };
