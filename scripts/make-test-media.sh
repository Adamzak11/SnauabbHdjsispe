#!/usr/bin/env bash
# Generates sample clips covering every Smart Repack path. Requires system ffmpeg.
set -euo pipefail
mkdir -p test-media && cd test-media
F="-hide_banner -loglevel error -y"
ffmpeg $F -f lavfi -i testsrc2=size=1080x1920:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 4 -c:v libx264 -preset veryfast -b:v 6M -pix_fmt yuv420p -c:a aac -b:a 128k compliant_1080x1920_30.mp4
ffmpeg $F -f lavfi -i testsrc2=size=2160x3840:rate=60 -f lavfi -i sine=frequency=330:sample_rate=48000 -t 2 -c:v libx265 -x265-params log-level=error -preset ultrafast -tag:v hvc1 -pix_fmt yuv420p10le -c:a aac uhd_hevc10_60.mov
ffmpeg $F -f lavfi -i testsrc2=size=1280x720:rate=25 -f lavfi -i sine=frequency=550:sample_rate=48000 -t 3 -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 2M -c:a libopus landscape_vp9.webm
ffmpeg $F -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=660:sample_rate=44100 -t 3 -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac rotated_tmp.mp4
ffmpeg $F -display_rotation 90 -i rotated_tmp.mp4 -c copy rotated_1920x1080_r90.mp4 && rm -f rotated_tmp.mp4
ffmpeg $F -f lavfi -i testsrc2=size=480x854:rate=30 -f lavfi -i sine=frequency=880:sample_rate=44100 -t 3 -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac lowres_480x854.mp4
ffmpeg $F -f lavfi -i testsrc2=size=720x1280:rate=30 -f lavfi -i sine=frequency=220:sample_rate=48000 -t 3 -c:v libx264 -preset veryfast -pix_fmt yuv444p -c:a pcm_s16le odd_444_pcm.mov
ffmpeg $F -f lavfi -i testsrc2=size=1080x1920:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 20 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac long_20s.mp4
echo "not a video" > bad.mp4
ls -la
