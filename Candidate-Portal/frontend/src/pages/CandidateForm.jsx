import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function CandidateForm() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    positionApplied: '',
    currentPosition: '',
    experienceYears: ''
  });
  const [resume, setResume] = useState(null);
  const navigate = useNavigate();

  async function onNext(e) {
    e.preventDefault();
    if (!resume) return alert('Please upload resume');

    if (resume.type !== 'application/pdf') return alert('Resume must be PDF');
    if (resume.size > 5 * 1024 * 1024) return alert('File must be ≤ 5MB');

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('resume', resume);

    const res = await api.createCandidate(fd);

    if (res.candidateId) {
      navigate(`/record?candidateId=${res.candidateId}`);
    } else {
      alert('Something went wrong');
    }
  }

  return (
    <div className="page-container">
      <h2>Candidate Information</h2>

      <form onSubmit={onNext}>
        {Object.keys(form).map(key => (
          <div className="mb-3" key={key}>
            <label className="form-label">{key.replace(/([A-Z])/g, ' $1')}</label>
            <input className="form-control"
              value={form[key]}
              onChange={e => setForm({ ...form, [key]: e.target.value })}
              required />
          </div>
        ))}

        <div className="mb-3">
          <label className="form-label">Upload Resume (PDF ≤ 5MB)</label>
          <input type="file" className="form-control"
            onChange={e => setResume(e.target.files[0])}
            required />
        </div>

        <button className="btn btn-primary w-100">Next</button>
      </form>
    </div>
  );
}
