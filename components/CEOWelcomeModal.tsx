import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Image } from 'react-native';

interface CEOWelcomeModalProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
}

export default function CEOWelcomeModal({ visible, onClose, userName }: CEOWelcomeModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header with gradient-like effect */}
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>RA</Text>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.ceoName}>Rasyid Aldy</Text>
              <Text style={styles.ceoTitle}>CEO & Founder</Text>
            </View>
          </View>

          {/* Message Content */}
          <View style={styles.content}>
            <Text style={styles.greeting}>
              Welcome to Zena, {userName}! 👋
            </Text>

            <Text style={styles.message}>
              I'm thrilled to have you here. Zena was built with one mission: to help you achieve financial wellness through intelligent insights and effortless money management.
            </Text>

            <Text style={styles.message}>
              Whether you're tracking daily expenses, planning your budget, or getting AI-powered financial advice — we're here to make your financial journey smoother.
            </Text>

            <Text style={styles.message}>
              If you ever need help or have suggestions, don't hesitate to reach out. We're constantly improving Zena based on feedback from users like you.
            </Text>

            <Text style={styles.signature}>
              Let's build better financial habits together! 💪
            </Text>

            <View style={styles.signatureBlock}>
              <Text style={styles.signatureName}>Rasyid Aldy</Text>
              <Text style={styles.signatureTitle}>CEO, Zena</Text>
            </View>
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Let's Get Started! 🚀</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#185FA5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerTextContainer: {
    flex: 1,
  },
  ceoName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F0F0F',
    marginBottom: 2,
  },
  ceoTitle: {
    fontSize: 14,
    color: '#666666',
  },
  content: {
    padding: 20,
    paddingTop: 15,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F0F0F',
    marginBottom: 15,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333',
    marginBottom: 12,
  },
  signature: {
    fontSize: 15,
    fontWeight: '600',
    color: '#185FA5',
    marginTop: 8,
    marginBottom: 15,
  },
  signatureBlock: {
    marginTop: 5,
  },
  signatureName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F0F0F',
  },
  signatureTitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#185FA5',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    margin: 20,
    marginTop: 10,
    shadowColor: '#185FA5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
