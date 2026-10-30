import React from 'react';
import { Play, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { formatDuration } from '../lib/utils';

export const RecentlyPlayed: React.FC = () => {
  const { recentlyPlayed, playEpisode } = useAudioPlayer();

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#171A18] dark:text-[#F3F4EF]">
          সম্প্রতি শোনা
        </h1>
        <p className="text-sm text-[#777C77] dark:text-[#A4ADA6] mt-1">
          যেসব পর্ব আপনি পূর্বে শুনেছেন বা শুরু করেছিলেন
        </p>
      </div>

      {recentlyPlayed.length > 0 ? (
        <div className="divide-y divide-[#E6E7E2]/50 dark:divide-[#233128]/50">
          {recentlyPlayed.map((item) => (
            <div
              key={item.episode.id}
              className="flex items-center justify-between gap-3 py-3 px-2 rounded-lg hover:bg-[#F0F1ED]/50 dark:hover:bg-[#19231D]/50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => playEpisode(item.episode, item.series, recentlyPlayed.map((i) => i.episode))}
                  className="p-1.5 rounded-full text-[#777C77] hover:text-[#176B50] dark:hover:text-[#48A783] transition-colors"
                  aria-label="আবার শুনুন"
                >
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                </button>

                <div className="min-w-0">
                  <Link
                    to={`/episodes/${item.episode.id}`}
                    className="text-sm font-medium text-[#171A18] dark:text-[#F3F4EF] hover:text-[#176B50] dark:hover:text-[#48A783] truncate block"
                  >
                    {item.episode.title}
                  </Link>
                  {item.series && (
                    <p className="text-xs text-[#777C77] dark:text-[#A4ADA6] truncate">
                      {item.series.title}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-xs text-[#777C77] dark:text-[#A4ADA6] font-mono">
                {item.episode.duration && (
                  <span className="tabular-nums hidden sm:inline">
                    {formatDuration(item.episode.duration)}
                  </span>
                )}
                <span>
                  {new Date(item.playedAt).toLocaleDateString('bn-BD', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-3">
          <h3 className="text-sm font-medium text-[#171A18] dark:text-[#F3F4EF]">
            কোনো শোনার ইতিহাস নেই
          </h3>
          <p className="text-xs text-[#777C77] dark:text-[#A4ADA6] max-w-xs mx-auto">
            আপনি যখনই কোনো অডিও শুনবেন, তা স্বয়ংক্রিয়ভাবে এখানে সংরক্ষিত থাকবে।
          </p>
          <div className="pt-2">
            <Link to="/browse">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <span>ব্রাউজ করুন</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
