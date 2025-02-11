'use client';
import { useState } from 'react';
import { ClassResult } from '@/types';

export default function Home() {
  const [nrp, setNrp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ClassResult[]>([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!nrp) {
      setError('Please enter an NRP');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setResults([]);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nrp }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to search');
      }

      setResults(data.results);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-white">
      <main className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">NRP Class Finder</h1>
          <p className="text-gray-600">Find classes by NRP</p>
          
          <div className="p-4 bg-yellow-50 rounded-lg text-yellow-800 border border-yellow-200">
            <p>Please login to MyITS first:</p>
            <a
              href="https://akademik.its.ac.id/myitsauth.php"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Login to MyITS →
            </a>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">NRP</label>
            <input
              type="text"
              value={nrp}
              onChange={(e) => setNrp(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900"
              placeholder="Enter NRP (e.g., 5025211015)"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isLoading ? 'Searching all classes...' : 'Search Classes'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-800 rounded border border-red-200">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Found {results.length} classes:
            </h2>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded bg-gray-50"
                >
                  <p className="font-medium text-gray-900">{result.course_name}</p>
                  <p className="text-sm text-gray-600">
                    Class {result.kelas} - {result.mk_id}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
