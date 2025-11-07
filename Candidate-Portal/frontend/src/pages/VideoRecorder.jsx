import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function VideoRecorder() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);

  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [error, setError] = useState('');

  const candidateId = new URLSearchParams(window.location.search).get('candidateId');

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError('Camera/microphone permission is required.');
      }
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startRecording = () => {
    setError('');
    setBlob(null);
    setSeconds(0);

    const stream = streamRef.current;
    if (!stream) return setError('No camera/microphone stream available.');

    const mimeType =
      MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' :
      MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' :
      'video/webm';
    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType });
    recorderRef.current = rec;

    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => { setBlob(new Blob(chunks, { type: mimeType })); };

    rec.start(1000);
    setRecording(true);

    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s + 1 >= 90) stopRecording(true);
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = (hitLimit = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    setRecording(false);
    if (hitLimit) setError('Video exceeds 90s. Please record again.');
  };

  const submitVideo = async () => {
    if (!candidateId) return setError('Missing candidate id.');
    if (!blob) return setError('Please record a video first.');
    if (seconds > 90) return setError('Video exceeds 90s. Please record again.');

    const fd = new FormData();
    fd.append('video', blob, 'intro.webm');

    const res = await api.uploadVideo(candidateId, fd);
    if (res?.videoFileId) navigate(`/review?candidateId=${candidateId}`);
    else setError(res?.message || 'Upload failed.');
  };

  return (
    <div className="page-container">

      <div className="blue-box">
        <b>Record a short video (≤ 90 seconds)</b><br/>
        Introduce yourself, explain interest in the position, experience, and long-term goals.
      </div>

      {error && <div className="red-box">{error}</div>}

      <div className="mb-3">
        <video ref={videoRef} className="w-100 rounded border" muted playsInline></video>
      </div>

      <p><b>Timer:</b> {seconds}s / 90s</p>

      {!recording && (
        <>
          <button className="btn btn-success me-2" onClick={startRecording}>Start Recording</button>

          {blob && (
            <button className="btn btn-primary me-2" onClick={submitVideo}>Submit</button>
          )}

          <button className="btn btn-outline-secondary" onClick={() => navigate(`/review?candidateId=${candidateId}`)}>
            Skip & Review
          </button>
        </>
      )}

      {recording && (
        <button className="btn btn-danger" onClick={() => stopRecording(false)}>Stop</button>
      )}
    </div>
  );
}
