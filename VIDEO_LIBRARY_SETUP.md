# Video library setup

The public library is available at `/videos.html`. Admins manage entries in **Admin → Content → Video Library**.

## Publish a tutorial

1. Host an MP4 or WebM file on your own site or a media host you control. Use a stable HTTPS URL; YouTube watch-page URLs are not playable sources and YouTube ad revenue does not go to the site embedding a video.
2. In the admin form, add the title, video URL, optional thumbnail, category, and description. Add a related tool path (for example `/tools/pdf-compressor`) to bring viewers into the product.
3. Save as Draft, preview the source URL, then change the status to Published.

The application stores video metadata and play counts. It does not upload, transcode, or store video files, so choose hosting with bandwidth and storage that fit your audience. Avoid temporary upload folders for permanent videos.

## Engagement and sponsorship

An engaged play is recorded after 10 seconds of actual playback, or 75% for videos shorter than 12 seconds. It is deduplicated per video and visitor per UTC day. The visitor identifier is a keyed hash of the request IP and user-agent; raw values are not stored by this feature. Set a unique `VIDEO_VIEW_SECRET` in production. If it is unset, the application falls back to `JWT_ACCESS_SECRET`.

Play counts measure engagement; they are not verified ad impressions and do not create income by themselves. For a predictable early revenue target, offer a clearly labeled direct sponsorship through the existing Advertise page and Ads Manager. For example, a $30 monthly sponsor averages $1/day in gross revenue while active; it is not guaranteed, and hosting costs reduce net profit. Programmatic video ads require an eligible provider account and ad inventory setup.
