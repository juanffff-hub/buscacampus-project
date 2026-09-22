const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

export async function getHealth() {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok)
    throw new Error("La API o la base de datos no están disponibles.");
  return response.json();
}
