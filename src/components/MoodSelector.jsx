import React from 'react';

/**
 * MoodSelector - A beautiful, interactive mood selector component
 * Allows users to select their current reading mood for AI-based book recommendations
 */

const MOODS = [
  {
    id: 'happy',
    label: 'Happy',
    emoji: '😊',
    color: 'from-yellow-400 to-orange-400',
    bgColor: 'bg-yellow-50',
    hoverColor: 'hover:bg-yellow-100',
    description: 'Feel-good & uplifting stories'
  },
  {
    id: 'romantic',
    label: 'Romantic',
    emoji: '💕',
    color: 'from-pink-400 to-rose-400',
    bgColor: 'bg-pink-50',
    hoverColor: 'hover:bg-pink-100',
    description: 'Love stories & romance'
  },
  {
    id: 'adventurous',
    label: 'Adventurous',
    emoji: '🗺️',
    color: 'from-green-400 to-teal-400',
    bgColor: 'bg-green-50',
    hoverColor: 'hover:bg-green-100',
    description: 'Action & adventure tales'
  },
  {
    id: 'mysterious',
    label: 'Mysterious',
    emoji: '🔍',
    color: 'from-purple-400 to-indigo-400',
    bgColor: 'bg-purple-50',
    hoverColor: 'hover:bg-purple-100',
    description: 'Mystery & suspense'
  },
  {
    id: 'inspiring',
    label: 'Inspiring',
    emoji: '✨',
    color: 'from-blue-400 to-cyan-400',
    bgColor: 'bg-blue-50',
    hoverColor: 'hover:bg-blue-100',
    description: 'Motivational & inspiring'
  },
  {
    id: 'sad',
    label: 'Reflective',
    emoji: '🌧️',
    color: 'from-gray-400 to-slate-400',
    bgColor: 'bg-gray-50',
    hoverColor: 'hover:bg-gray-100',
    description: 'Emotional & moving stories'
  },
  {
    id: 'calm',
    label: 'Calm',
    emoji: '🍃',
    color: 'from-emerald-400 to-green-400',
    bgColor: 'bg-emerald-50',
    hoverColor: 'hover:bg-emerald-100',
    description: 'Peaceful & cozy reads'
  },
  {
    id: 'dark',
    label: 'Dark',
    emoji: '🌑',
    color: 'from-slate-600 to-gray-700',
    bgColor: 'bg-slate-50',
    hoverColor: 'hover:bg-slate-100',
    description: 'Thriller & dark fiction'
  },
  {
    id: 'fantastical',
    label: 'Fantastical',
    emoji: '🧙',
    color: 'from-violet-400 to-purple-400',
    bgColor: 'bg-violet-50',
    hoverColor: 'hover:bg-violet-100',
    description: 'Fantasy & magical worlds'
  },
  {
    id: 'thoughtful',
    label: 'Thoughtful',
    emoji: '💭',
    color: 'from-indigo-400 to-blue-400',
    bgColor: 'bg-indigo-50',
    hoverColor: 'hover:bg-indigo-100',
    description: 'Literary & philosophical'
  }
];

export default function MoodSelector({ selectedMood, onMoodChange, className = '' }) {
  return (
    <div className={`mood-selector ${className}`}>
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">
          How are you feeling today?
        </h3>
        <p className="text-slate-600">
          Choose your mood and we'll recommend the perfect books for you
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {MOODS.map((mood) => {
          const isSelected = selectedMood === mood.id;
          
          return (
            <button
              key={mood.id}
              onClick={() => onMoodChange(mood.id)}
              className={`
                mood-card group relative
                p-4 rounded-2xl border-2 transition-all duration-300
                ${isSelected 
                  ? `border-transparent bg-gradient-to-br ${mood.color} text-white shadow-lg scale-105` 
                  : `border-white/50 ${mood.bgColor} ${mood.hoverColor} text-slate-700 hover:scale-105 hover:shadow-md`
                }
              `}
              aria-label={`Select ${mood.label} mood`}
              aria-pressed={isSelected}
            >
              {/* Emoji icon */}
              <div className={`
                text-4xl mb-2 transition-transform duration-300
                ${isSelected ? 'scale-110' : 'group-hover:scale-110'}
              `}>
                {mood.emoji}
              </div>

              {/* Label */}
              <div className="font-semibold text-sm mb-1">
                {mood.label}
              </div>

              {/* Description - only show on hover or when selected */}
              <div className={`
                text-xs transition-opacity duration-200
                ${isSelected 
                  ? 'opacity-90' 
                  : 'opacity-0 group-hover:opacity-70'
                }
              `}>
                {mood.description}
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                  <span className="text-xs">✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Clear selection button */}
      {selectedMood && (
        <div className="mt-4 text-center">
          <button
            onClick={() => onMoodChange(null)}
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Clear mood selection
          </button>
        </div>
      )}
    </div>
  );
}

// Export moods array for use elsewhere
export { MOODS };
