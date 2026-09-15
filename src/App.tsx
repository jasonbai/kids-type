import { Routes, Route, Navigate } from 'react-router-dom';
import { LearningProvider } from './store/learning';
import { ThemeProvider } from './context/theme-provider';
import TopNav from './components/TopNav';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import PracticePage from './pages/PracticePage';
import ReviewPage from './pages/ReviewPage';
import WrongBookPage from './pages/WrongBookPage';
import StatsPage from './pages/StatsPage';

export default function App() {
  return (
    <ThemeProvider>
      <LearningProvider>
        <div className="flex min-h-svh flex-col bg-background text-foreground">
          <TopNav />
          {/* 窄屏提示：指法练习需要实体键盘 */}
          <p className="bg-warn/10 px-4 py-2 text-center text-sm font-medium text-warn md:hidden">
            📱 打字练习需要实体键盘，请在电脑或配有键盘的平板上使用
          </p>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/wrong" element={<WrongBookPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
        </div>
      </LearningProvider>
    </ThemeProvider>
  );
}
