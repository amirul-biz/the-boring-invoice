import { CryptoService } from '../../crypto/crypto.service';
import { RecipientDTO, SupplierDTO } from '../invoice-dto';

export function encryptRecipient(recipient: RecipientDTO, cryptoService: CryptoService): RecipientDTO {
  return {
    ...recipient,
    email: recipient.email ? cryptoService.encrypt(recipient.email) : recipient.email,
    phone: cryptoService.encrypt(recipient.phone),
    tin: recipient.tin ? cryptoService.encrypt(recipient.tin) : recipient.tin,
    registrationNumber: cryptoService.encrypt(recipient.registrationNumber),
  };
}

export function decryptRecipient(recipient: RecipientDTO, cryptoService: CryptoService): RecipientDTO {
  return {
    ...recipient,
    email: recipient.email ? cryptoService.decrypt(recipient.email) : recipient.email,
    phone: cryptoService.decrypt(recipient.phone),
    tin: recipient.tin ? cryptoService.decrypt(recipient.tin) : recipient.tin,
    registrationNumber: cryptoService.decrypt(recipient.registrationNumber),
  };
}

export function encryptSupplier(supplier: SupplierDTO, cryptoService: CryptoService): SupplierDTO {
  return {
    ...supplier,
    email: cryptoService.encrypt(supplier.email),
    tin: cryptoService.encrypt(supplier.tin),
    registrationNumber: cryptoService.encrypt(supplier.registrationNumber),
    msicCode: cryptoService.encrypt(supplier.msicCode),
    contactNumber: supplier.contactNumber ? cryptoService.encrypt(supplier.contactNumber) : undefined,
  };
}

export function decryptSupplier(supplier: SupplierDTO, cryptoService: CryptoService): SupplierDTO {
  return {
    ...supplier,
    email: cryptoService.decrypt(supplier.email),
    tin: cryptoService.decrypt(supplier.tin),
    registrationNumber: cryptoService.decrypt(supplier.registrationNumber),
    msicCode: cryptoService.decrypt(supplier.msicCode),
    contactNumber: supplier.contactNumber ? cryptoService.decrypt(supplier.contactNumber as string) : undefined,
  };
}
