'use client';
import { useState } from 'react';
import { ClassResult } from '@/types';

export default function Home() {
  const [nrp, setNrp] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ClassResult[]>([]);
  const [error, setError] = useState('');
  const [studentName, setStudentName] = useState(''); // tambahkan state untuk nama
  const [searchDuration, setSearchDuration] = useState<number>(0);

  const SessionInstructions = () => (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg text-blue-800 border border-blue-200">
      <p className="font-medium">How to get your session ID:</p>
      <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
        <li>Login to <a href="https://akademik.its.ac.id/home.php" target="_blank" rel="noopener noreferrer" className="underline">MyITS Home</a></li>
        <li>Press F12 to open Developer Tools</li>
        <li>Go to Application → Cookies → akademik.its.ac.id</li>
        <li>Find <code className="bg-blue-100 px-1">PHPSESSID</code> and copy its value to the input above</li>
      </ol>
    </div>
  );

  const LoadingSpinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  const SearchProcessInfo = () => (
    <div className="mt-4 p-4 bg-yellow-50 rounded-lg text-yellow-800 border border-yellow-200 text-sm">
      <p className="font-medium">Search Process Information:</p>
      <ol className="list-decimal ml-5 mt-2 space-y-1">
        <li>Searching through all possible classes in Informatics Department</li>
        <li>Matching NRP with class rosters</li>
        <li>Average search duration is below 1 minute</li>
      </ol>
    </div>
  );

  const handleSearch = async () => {
    if (!nrp || !sessionId) {
      setError('Please enter both NRP and Session ID');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setResults([]);
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 295000); // 4m55s timeout

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nrp, sessionId }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'Network response was not ok'
        }));
        throw new Error(errorData.error || 'Failed to search');
      }

      const data = await response.json();
      setResults(data.results);
      // Set nama mahasiswa dari hasil pertama yang ditemukan
      if (data.results.length > 0) {
        setStudentName(data.results[0].name);
      }
      setSearchDuration((Date.now() - startTime) / 1000); // Convert to seconds

    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Search took too long. Please try again.');
      } else {
        setError(error instanceof Error ? error.message : 'An error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-white">
      <main className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">NRP Class Finder</h1>
            <p className="text-gray-600">
            For Informatics Departement -{' '}
            <a
              href="https://github.com/daf2a/nrp-class-finder"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              GitHub Project
            </a>
            </p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Session ID</label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded font-mono bg-white text-gray-900"
              placeholder="Enter your PHPSESSID"
            />
            <SessionInstructions />
          </div>

            <div>
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  Searching...
                </>
              ) : (
                'Search Classes'
              )}
            </button>
            {isLoading && <SearchProcessInfo />}
            </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-800 rounded border border-red-200">
            {error}
          </div>
        )}
        
        {!isLoading && searchDuration > 0 && results.length === 0 && !error && (
          <div className="p-4 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">
            <p>This student is not enrolled in any Informatics Department classes.</p>
            <p className="text-sm mt-1">Search completed in {searchDuration.toFixed(2)} seconds</p>
          </div>
        )}

        {results.length > 0 &&             
          <div>
            <p className="text-sm text-gray-600">
                Search completed in {searchDuration.toFixed(2)} seconds
            </p>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {studentName} enrolled {results.length} classes ({results.reduce((sum, r) => sum + r.credits, 0)} SKS):
              </h2>
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="p-4 border border-gray-200 rounded bg-gray-50"
                  >
                    <p className="font-medium text-gray-900">{result.course_name}</p>
                    <p className="text-sm text-gray-600">
                      Class {result.kelas} - {result.mk_id} ({result.credits} SKS)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        }
      </main>
    </div>
  );
}
