import { useState } from 'react';

export default function MatcherTable({ profile, onSave }) {
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(profile)));

  const updateMatcher = (index, m) => {
    const matchers = [...(draft.matchers || [])];
    matchers[index] = { ...matchers[index], ...m };
    setDraft({ ...draft, matchers });
  };

  const addMatcher = () => {
    const key = prompt('Profile field key to match:');
    if (!key) return;
    const patterns = prompt('Label patterns (comma-separated):');
    if (!patterns) return;
    const m = {
      field_key: key,
      label_patterns: patterns.split(',').map(s => s.trim()).filter(Boolean),
      enabled: true,
      match_type: 'substring'
    };
    setDraft({ ...draft, matchers: [...(draft.matchers || []), m] });
  };

  const removeMatcher = (index) => {
    if (!confirm('Remove this matcher?')) return;
    const matchers = [...(draft.matchers || [])];
    matchers.splice(index, 1);
    setDraft({ ...draft, matchers });
  };

  const matchers = draft.matchers || [];

  return (
    <div>
      <div className="card">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <h2 style={{margin:0}}>Pattern Matching</h2>
            <p className="muted" style={{margin:'4px 0 0 0'}}>
              Map form labels to your profile fields. The extension uses these to auto-fill.
            </p>
          </div>
          <div style={{display:'flex', gap:'8px'}}>
            <button className="primary" onClick={() => onSave(draft)}>Save</button>
            <button onClick={addMatcher}>+ Add matcher</button>
          </div>
        </div>
      </div>
      {matchers.length === 0 && (
        <div className="card">
          <p className="muted">No matchers yet. Add one above, or import the default profile.</p>
        </div>
      )}
      {matchers.map((m, i) => (
        <div key={i} className="card matcher-row">
          <div className="matcher-header">
            <label className="toggle">
              <span className={m.enabled ? 'switch on' : 'switch'} onClick={() => updateMatcher(i, { enabled: !m.enabled })}></span>
              {m.enabled ? 'enabled' : 'disabled'}
            </label>
            <code className="field-key">{m.field_key}</code>
            <span className="badge">{m.match_type}</span>
            <button className="danger small" onClick={() => removeMatcher(i)}>Remove</button>
          </div>
          <div className="matcher-body">
            <label>Label patterns (one per line)</label>
            <textarea
              rows={Math.max(2, (m.label_patterns || []).length + 1)}
              value={(m.label_patterns || []).join('\n')}
              onChange={e => updateMatcher(i, { label_patterns: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
            />
            <div style={{marginTop:'8px'}}>
              <label style={{marginRight:'12px'}}>Match type:</label>
              <select value={m.match_type || 'substring'} onChange={e => updateMatcher(i, { match_type: e.target.value })}>
                <option value="substring">substring</option>
                <option value="exact">exact</option>
                <option value="fuzzy">fuzzy</option>
                <option value="regex">regex</option>
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
