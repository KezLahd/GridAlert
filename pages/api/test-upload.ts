import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchAndUploadOutages } from '../../utils/fetchAusgridOutages'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await fetchAndUploadOutages()
  res.status(200).json({ message: 'Upload completed ✅' })
}
