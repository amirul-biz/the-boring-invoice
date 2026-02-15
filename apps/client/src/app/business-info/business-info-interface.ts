export interface IBusinessInfo {
  id?: string;
  businessName: string;
  businessEmail: string;
  taxIdentificationNumber: string;
  businessRegistrationNumber: string;
  businessActivityDescription: string;
  categoryCode: string;
  userSecretKey: string;
}

export interface IBusinessInfoPublic {
  id: string;
  businessName: string;
  businessEmail: string;
  taxIdentificationNumber: string;
  businessRegistrationNumber: string;
  businessActivityDescription: string;
  categoryCode: string;
}
