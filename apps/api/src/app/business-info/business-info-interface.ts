export interface CreateBusinessInfoData {
  userId: string;
  businessName: string;
  businessEmail: string;
  taxIdentificationNumber: string;
  businessRegistrationNumber: string;
  businessActivityDescription: string;
}

export interface UpdateBusinessInfoData {
  businessName?: string;
  businessEmail?: string;
  taxIdentificationNumber?: string;
  businessRegistrationNumber?: string;
  businessActivityDescription?: string;
}
