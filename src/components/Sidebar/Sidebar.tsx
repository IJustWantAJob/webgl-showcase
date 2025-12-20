/**
 * Sidebar Component
 *
 * Contains search and demo list.
 */

import { SearchBar } from './SearchBar';
import { DemoList } from './DemoList';
import './Sidebar.css';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <SearchBar />
      <DemoList />
    </aside>
  );
}
