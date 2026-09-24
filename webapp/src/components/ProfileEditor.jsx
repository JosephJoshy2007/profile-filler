import { useState } from 'react';

export default function ProfileEditor({ profile, onSave }) {
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(profile)));
  const [filter, setFilter] = useState('');

  const updateField = (key, field) => {
    setDraft(d => ({
      ...d,
      fields: { ...d.fields, [key]: { ...(d.fields[key] || {}), ...field } }
    }));
  };

  const addField = () => {
    const key = prompt('Field key (no spaces):');
    if (!key || draft.fields[key]) return;
    updateField(key, { value: '', type: 'text' });
  };

  const removeField = (key) => {
    if (!confirm(`Remove field "${key}"?`)) return;
    setDraft(d => {
      const fields = { ...d.fields };
      delete fields[key];
      return { ...d, fields };
    });
  };

  const entries = Object.entries(draft.fields || {});
  const filtered = filter
    ? entries.filter(([k, v]) => k.toLowerCase().includes(filter.toLowerCase()) || String(v.value).toLowerCase().includes(filter.toLowerCase()))
    : entries;

  return (
    <div>
      <div className="card">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <h2 style={{margin:0}}>Profile Fields</h2>
          <div style={{display:'flex', gap:'8px'}}>
            <input type="search" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} />
            <button className="primary" onClick={() => onSave(draft)}>Save</button>
            <button onClick={addField}>+ Add field</button>
          </div>
        </div>
      </div>
      {filtered.map(([key, field]) => (
        <FieldRow key={key} fieldKey={key} field={field} onChange={(f) => updateField(key, f)} onRemove={() => removeField(key)} />
      ))}
    </div>
  );
}

function FieldRow({ fieldKey, field, onChange, onRemove }) {
  return (
    <div className="card field-row">
      <div className="row-header">
        <code className="field-key">{fieldKey}</code>
        <span className="badge">{field.type}</span>
        <button className="danger small" onClick={onRemove}>Remove</button>
      </div>
      <div className="row-body">
        {field.type === 'text' && (
          <input
            value={field.value || ''}
            onChange={e => onChange({ value: e.target.value })}
            placeholder="Value"
          />
        )}
        {field.type === 'date' && (
          <input
            type="date"
            value={field.value || ''}
            onChange={e => onChange({ value: e.target.value })}
          />
        )}
        {field.type === 'number' && (
          <input
            type="number"
            value={field.value || ''}
            onChange={e => onChange({ value: e.target.value })}
          />
        )}
        {field.type === 'single_choice' && (
          <select
            value={field.value || ''}
            onChange={e => onChange({ value: e.target.value })}
          >
            <option value="">— none —</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}
        {field.type === 'multi_choice' && (
          <div className="checkbox-group">
            {(field.options || []).map(opt => {
              const selected = Array.isArray(field.value) ? field.value.includes(opt) : false;
              return (
                <label key={opt} className="checkbox">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={e => {
                      const cur = Array.isArray(field.value) ? field.value : [];
                      const next = e.target.checked
                        ? [...cur, opt]
                        : cur.filter(v => v !== opt);
                      onChange({ value: next });
                    }}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
