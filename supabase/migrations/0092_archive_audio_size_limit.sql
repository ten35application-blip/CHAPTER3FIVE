-- 0092_archive_audio_size_limit
--
-- Fable audit: the archive-audio bucket (created in 0029) has no
-- file_size_limit or allowed_mime_types, so a user can upload a
-- ~5 GB blob and every /api/whisper call transcribes ~$0.006 per
-- minute of audio. Also there's no per-user rate limit on the
-- whisper route itself (added in code in the same commit).
--
-- 10 MB is generous for a 4-minute answer at high bitrate but well
-- below what would cause OpenAI-side surprise. Types are restricted
-- to what the recorder actually produces (webm/mp4/m4a/wav/mp3/mpeg
-- families).

update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array[
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav'
    ]
where id = 'archive-audio';
