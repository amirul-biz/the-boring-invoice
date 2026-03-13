import { BusinessAddressDTO } from './business-info-dto';
import { CreateBusinessInfoDTO } from './business-info-dto';

// Internal: extends DTO with userId added by the service before calling the repository
export interface CreateBusinessInfoData extends CreateBusinessInfoDTO {
  userId: string;
}

// Internal: response shape for public endpoint (no userSecretKey)
export interface BusinessInfoPublicData {
  id: string;
  businessName: string;
  businessEmail: string;
  taxIdentificationNumber: string;
  businessRegistrationNumber: string;
  businessActivityDescription: string;
  msicCode: string;
  categoryCode: string;
  idType?: string;
  sstRegistrationNumber?: string;
  businessContactNumber: string;
  address?: BusinessAddressDTO;
  invoiceVersion: string;
}

// Internal: used by queue consumers — never exposed over HTTP
export interface PaymentIntegrationCredential {
  categoryCode: string;
  userSecretKey: string;
}
