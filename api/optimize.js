import { handleOptimize } from "./_lib/promptDoctorHandlers.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  return handleOptimize(req, res);
}
