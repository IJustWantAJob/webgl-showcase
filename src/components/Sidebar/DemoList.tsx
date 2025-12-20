/**
 * DemoList Component
 *
 * Filterable list of demos grouped by category.
 */

import { useMemo } from 'react';
import { usePlayground } from '../../context/PlaygroundContext';
import { filterDemos, getDemosByCategory } from '../../gl/demoRegistry';
import type { DemoCategory, DemoMetadata } from '../../gl/core/types';

const CATEGORIES: { id: DemoCategory; label: string; icon: string }[] = [
  { id: 'shaders', label: 'Shaders', icon: 'S' },
  { id: 'geometry', label: 'Geometry', icon: 'G' },
  { id: 'performance', label: 'Performance', icon: 'P' },
  { id: 'postprocess', label: 'Post-Process', icon: 'PP' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#10b981',
  intermediate: '#f59e0b',
  advanced: '#ef4444',
};

export function DemoList() {
  const { state, setActiveDemo, setCategoryFilter } = usePlayground();

  // Filter demos based on search and category
  const filteredDemos = useMemo(() => {
    return filterDemos(state.categoryFilter, state.searchQuery);
  }, [state.categoryFilter, state.searchQuery]);

  // Group by category if no filter
  const groupedDemos = useMemo(() => {
    if (state.categoryFilter || state.searchQuery) {
      return { all: filteredDemos };
    }
    const groups: Record<string, DemoMetadata[]> = {};
    CATEGORIES.forEach((cat) => {
      const demos = getDemosByCategory(cat.id);
      if (demos.length > 0) {
        groups[cat.id] = demos;
      }
    });
    return groups;
  }, [filteredDemos, state.categoryFilter, state.searchQuery]);

  return (
    <div className="demo-list">
      {/* Category Filters */}
      <div className="category-filters">
        <button
          className={`category-btn ${!state.categoryFilter ? 'active' : ''}`}
          onClick={() => setCategoryFilter(null)}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`category-btn ${state.categoryFilter === cat.id ? 'active' : ''}`}
            onClick={() =>
              setCategoryFilter(state.categoryFilter === cat.id ? null : cat.id)
            }
            title={cat.label}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Demo Items */}
      <div className="demo-items">
        {Object.entries(groupedDemos).map(([category, demos]) => (
          <div key={category} className="demo-group">
            {category !== 'all' && (
              <h3 className="demo-group-title">
                {CATEGORIES.find((c) => c.id === category)?.label || category}
              </h3>
            )}
            {demos.map((demo) => (
              <DemoItem
                key={demo.id}
                demo={demo}
                isActive={state.activeDemoId === demo.id}
                onClick={() => setActiveDemo(demo.id)}
              />
            ))}
          </div>
        ))}
        {filteredDemos.length === 0 && (
          <div className="demo-empty">No demos found</div>
        )}
      </div>
    </div>
  );
}

interface DemoItemProps {
  demo: DemoMetadata;
  isActive: boolean;
  onClick: () => void;
}

function DemoItem({ demo, isActive, onClick }: DemoItemProps) {
  return (
    <button
      className={`demo-item ${isActive ? 'active' : ''} ${demo.wip ? 'wip' : ''}`}
      onClick={onClick}
    >
      <div className="demo-item-header">
        <span className="demo-item-name">{demo.name}</span>
        <span
          className="demo-item-difficulty"
          style={{ backgroundColor: DIFFICULTY_COLORS[demo.difficulty] }}
          title={demo.difficulty}
        />
      </div>
      <div className="demo-item-tags">
        {demo.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="demo-item-tag">
            {tag}
          </span>
        ))}
        {demo.wip && <span className="demo-item-wip">WIP</span>}
      </div>
    </button>
  );
}
