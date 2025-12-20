/**
 * DemoDescription Component
 *
 * Shows demo title, description, technique notes, and performance notes.
 */

import { usePlayground } from '../../context/PlaygroundContext';
import { getDemoById } from '../../gl/demoRegistry';

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Beginner', color: '#10b981' },
  intermediate: { label: 'Intermediate', color: '#f59e0b' },
  advanced: { label: 'Advanced', color: '#ef4444' },
};

export function DemoDescription() {
  const { state } = usePlayground();
  const demo = getDemoById(state.activeDemoId);

  if (!demo) {
    return (
      <div className="demo-description">
        <p className="demo-description-empty">Demo not found</p>
      </div>
    );
  }

  const difficultyInfo = DIFFICULTY_LABELS[demo.difficulty];

  return (
    <div className="demo-description">
      <div className="demo-description-header">
        <h2 className="demo-description-title">{demo.name}</h2>
        <span
          className="demo-description-difficulty"
          style={{ backgroundColor: difficultyInfo.color }}
        >
          {difficultyInfo.label}
        </span>
        {demo.wip && <span className="demo-description-wip">Work in Progress</span>}
      </div>

      <p className="demo-description-text">{demo.description}</p>

      {demo.techniqueNotes.length > 0 && (
        <div className="demo-description-section">
          <h4 className="demo-description-subtitle">Techniques Used</h4>
          <ul className="demo-description-list">
            {demo.techniqueNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {demo.perfNotes && (
        <div className="demo-description-section">
          <h4 className="demo-description-subtitle">Performance Notes</h4>
          <p className="demo-description-perf">{demo.perfNotes}</p>
        </div>
      )}

      <div className="demo-description-tags">
        {demo.tags.map((tag) => (
          <span key={tag} className="demo-description-tag">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
