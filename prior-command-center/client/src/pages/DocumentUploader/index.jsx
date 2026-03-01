import { useState } from 'react';
import StartScreen from './StartScreen';
import ReviewScreen from './ReviewScreen';
import ConfirmationScreen from './ConfirmationScreen';
import './uploader.css';

export default function DocumentUploader() {
  const [screen, setScreen] = useState('start');
  const [parsedData, setParsedData] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [savedResult, setSavedResult] = useState(null);

  function handleParsed(data, images) {
    setParsedData(data);
    setImageFiles(images || []);
    setScreen('review');
  }

  function handleSaved(result) {
    setSavedResult(result);
    setScreen('confirmation');
  }

  function handleReset() {
    setParsedData(null);
    setImageFiles([]);
    setSavedResult(null);
    setScreen('start');
  }

  return (
    <div className="document-uploader">
      {screen === 'start' && <StartScreen onParsed={handleParsed} />}
      {screen === 'review' && (
        <ReviewScreen
          data={parsedData}
          imageFiles={imageFiles}
          onSaved={handleSaved}
          onCancel={handleReset}
        />
      )}
      {screen === 'confirmation' && (
        <ConfirmationScreen result={savedResult} onReset={handleReset} />
      )}
    </div>
  );
}
