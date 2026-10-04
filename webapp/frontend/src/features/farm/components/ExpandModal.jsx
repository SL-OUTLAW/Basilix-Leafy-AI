import Modal from "../../../components/common/Modal/Modal";

function ExpandModal({ title, children, onClose, fullScreen = false }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      fullScreen={fullScreen}
      size="medium"
    >
      {children}
    </Modal>
  );
}

export default ExpandModal;
