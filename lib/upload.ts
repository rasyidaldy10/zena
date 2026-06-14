import { supabase } from './supabase'

/**
 * Upload gambar ke Supabase Storage bucket 'logos' (publik).
 * Cross-platform: fetch uri -> blob -> upload. Return public URL.
 */
export async function uploadImage(uri: string, folder: 'logos' | 'avatars'): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    const res = await fetch(uri)
    const blob = await res.blob()
    const ext = blob.type.includes('png') ? 'png' : 'jpg'
    const path = `${folder}/${session.user.id}-${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('logos').upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    })
    if (error) {
      console.error('Upload error:', error.message)
      return null
    }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.error('uploadImage failed:', e)
    return null
  }
}
