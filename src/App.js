import { useState } from 'react';
import AWS from 'aws-sdk';
import { Spinner, Modal } from 'flowbite-react';
import './App.css';

function App() {
  const [name, setName] = useState('');
  const [openModal, setOpenModal] = useState();
  const [file, setFile] = useState(null);
  const props = { openModal, setOpenModal };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFile(file);
  };

  const upload = async (e) => {
    e.preventDefault();
    props.setOpenModal('default');
    const S3_BUCKET = 'hammer-wp';
    const REGION = 'us-east-1';

    AWS.config.update({
      accessKeyId: 'you accessKeyId',
      secretAccessKey: 'your secretAccessKey',
    });
    const s3 = new AWS.S3({
      params: { Bucket: S3_BUCKET },
      region: REGION,
    });

    const params = {
      Bucket: S3_BUCKET,
      Key: file.name,
      Body: file,
      Tagging: `name=${name}`,
    };

    var upload = s3
      .putObject(params)
      .on('httpUploadProgress', (evt) => {
        console.log(
          'Uploading ' + parseInt((evt.loaded * 100) / evt.total) + '%'
        );
      })
      .promise();

    await upload.then((err, data) => {
      console.log(err);
      // Post info to AWS api gateway
      postFileInfo();
    });
  };

  const postFileInfo = () => {
    const bodyParams = {
      filename: file.name,
      comment: name
    }
    const config = { method: 'POST', body: JSON.stringify(bodyParams), headers: { 'Content-Type': 'application/json' } };
    fetch('https://jffaq3f3u3.execute-api.us-east-1.amazonaws.com/test', config).then((response) => {
      props.setOpenModal(undefined);
      console.log('success', response);
    });
  }

  return (
    <div className="App">
      <form onSubmit={upload}>
        <div className="mb-6">
          <label
            htmlFor="comment"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            User comment
          </label>
          <input
            type="text"
            id="comment"
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            htmlFor="user_file"
          >
            Upload file
          </label>
          <input
            className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
            aria-describedby="user_file_help"
            id="user_file"
            type="file"
            onChange={handleFileChange}
            required
          />
          <div
            className="mt-1 text-sm text-gray-500 dark:text-gray-300"
            id="user_file_help"
          >
            Please select text file for upload to s3.
          </div>
        </div>
        <div className="action">
          <button
            type="submit"
            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            Submit
          </button>
        </div>
      </form>
      <Modal show={props.openModal === 'default'} onClose={() => props.setOpenModal(undefined)}>
        <Modal.Header>Notice</Modal.Header>
        <Modal.Body>
          <div className="space-y-6">
            <div className="text-center">
              <Spinner aria-label="Default status example" />
            </div>
            <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400">
              Please wait upload file to s3.
            </p>
            <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400">
              If uploaded successfully, will auto close this modal.
            </p>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default App;
