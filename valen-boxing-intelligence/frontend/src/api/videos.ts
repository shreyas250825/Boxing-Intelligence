import apiClient from './client'
import type { Video, SingleResponse } from '../types'

export const getVideo = (id: string) =>
  apiClient.get<SingleResponse<Video>>(`/api/v1/videos/${id}`).then(r => r.data.data)

export const deleteVideo = (id: string) =>
  apiClient.delete(`/api/v1/videos/${id}`)

export const uploadVideo = (
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<{ video_id: string; session_id: string; status: string; original_filename_safe: string; file_size_bytes: number; uploaded_at: string }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    xhr.open('POST', `${base}/api/v1/videos/upload`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText)
          resolve(json.data)
        } catch {
          reject(new Error('Invalid response'))
        }
      } else {
        try {
          const json = JSON.parse(xhr.responseText)
          const err = new Error(json.error?.message || 'Upload failed') as Error & { code: string }
          err.code = json.error?.code || 'UPLOAD_FAILED'
          reject(err)
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`))
        }
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(formData)
  })
}
