import React from "react";
import { View, Button, Alert } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { BASE_URL, endpoints } from '../api';

type Props = {
  navigation: any;
};

const TestPayment: React.FC<Props> = ({ navigation }) => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const initializePaymentSheet = async () => {
    try {

        const csrfRes = await fetch(`${BASE_URL}/api/csrf-token/`, {
        credentials: 'include',                      
        });
        if (!csrfRes.ok) throw new Error('Failed to fetch CSRF token');
        const { csrfToken } = await csrfRes.json();     
        console.log('csrfToken:', csrfToken);
    
    
        const response = await fetch(endpoints.createPaymentIntent(), {
            method: 'POST',
            credentials: 'include',                    
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,                
            },
        });
        const { client_secret } = await response.json();

        const initResponse = await initPaymentSheet({
            merchantDisplayName: "App Name",
            paymentIntentClientSecret: client_secret,
        });

      if (initResponse.error) {
        Alert.alert("Error", initResponse.error.message);
      }

    //   // Normally fetch from your Django backend
    //   const response = await fetch("http://YOUR_BACKEND_URL/create-payment-intent", {
    //     method: "POST",
    //   });
    //   const { paymentIntent, ephemeralKey, customer } = await response.json();

    //   const { error } = await initPaymentSheet({
    //     customerId: customer,
    //     customerEphemeralKeySecret: ephemeralKey,
    //     paymentIntentClientSecret: paymentIntent,
    //     merchantDisplayName: "My App",
    //   });

    //   if (!error) {
    //     Alert.alert("Payment sheet initialized");
    //   } else {
    //     console.warn(error);
    //   }
    } catch (err) {
      console.error(err);
    }
  };

  const openPaymentSheet = async () => {
    const { error } = await presentPaymentSheet();
    if (error) {
      Alert.alert(`Error: ${error.message}`);
    } else {
      Alert.alert("Success! Payment confirmed.");
      // Here you could call your backend to "pay the winner"
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Button title="Init Payment" onPress={initializePaymentSheet} />
      <Button title="Pay $5" onPress={openPaymentSheet} />
    </View>
  );
};

export default TestPayment;
